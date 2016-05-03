/* jshint node: true */
'use strict';

var User = require(__dirname + '/../models/user');
var Request = require(__dirname + '/../models/request');
var Warning = require(__dirname + '/../models/warning');
var Access = require(__dirname + '/../config/access');
var DateOnly = require('dateonly');
var moment = require('moment');
var jade = require('jade');
var path = require('path');
var fs = require('fs');
var twilio = require('twilio');
var mailgun = require('mailgun-js');
var mailcomposer = require('mailcomposer');
var mongoose = require('mongoose');
var countryFilePath = __dirname + '/../public/data/countryList.json';
var countryListFile = fs.readFileSync(countryFilePath, 'utf8');
var countriesDictionary = JSON.parse(countryListFile);

// Attempt to load credentials for email and SMS
var dropEmail = true;
var dropSMS = true;

if (process.env.MAILGUN_KEY !== undefined &&
	process.env.BONVOYAGE_DOMAIN !== undefined) {
	var mailgun = mailgun({
		apiKey: process.env.MAILGUN_KEY,
		domain: 'projectdelta.io', // this is temporary
	});
	dropEmail = false;
}

if (process.env.TWILIO_SID !== undefined &&
	process.env.TWILIO_AUTH !== undefined) {
	var twilioClient = new twilio.RestClient(process.env.TWILIO_SID,
		process.env.TWILIO_AUTH);
	dropSMS = false;
}

/*
 * Helper Functions
 */
module.exports.getStartDate = function (request) {
	if (request.legs.length > 0) {
		var startDate = new DateOnly(request.legs[0].startDate);
		for (var i = 1; i < request.legs.length; i++) {
			var d = new DateOnly(request.legs[i].startDate);
			if (d < startDate) {
				startDate = d;
			}
		}

		return startDate;
	} else {
		return undefined;
	}
};

module.exports.getEndDate = function (request) {
	if (request.legs.length > 0) {
		var endDate = new DateOnly(request.legs[0].endDate);
		for (var i = 1; i < request.legs.length; i++) {
			var d = new DateOnly(request.legs[i].endDate);
			if (d > endDate) {
				endDate = d;
			}
		}

		return endDate;
	} else {
		return undefined;
	}
};

module.exports.getRequests = function (req, res, options, cb) {
	if (req.user) {
		var matchUsers = {};
		if (options && options._id) {
			matchUsers._id = mongoose.Types.ObjectId(options._id);
			console.log('Looking for request with id: ' + matchUsers._id);
		}

		if (req.user.access < Access.STAFF) {
			matchUsers.volunteer = req.user._id;
		}

		if (options && options.staffId) {
			matchUsers.staff = req.staffId;
		}

		if (options && options.userId) {
			matchUsers.volunteer = req.userId;
		}

		Request
			.find(matchUsers)
			.populate({
				path: 'staff comments.user volunteer',
				select: '-hash',
			})
			.lean()
			.exec(function (err, requests) {
				if (err) {
					return cb(err);
				} else {
					// Only show requests from the same country, if staff level
					if (req.user.access == Access.STAFF) {
						requests = requests.filter(function (request) {
							return request.volunteer.countryCode == req.user.countryCode;
						});
					}

					// Add start and end date to all requests
					for (var i = 0; i < requests.length; i++) {
						requests[i].startDate = module.exports.getStartDate(requests[i]);
						requests[i].endDate = module.exports.getEndDate(requests[i]);
					}

					cb(null, requests);
				}
			});
	} else {
		cb(new Error('User not logged in!'));
	}
};

module.exports.getUsers = function (options, cb) {
	var q = (options.user !== undefined ? options.user : {});
	if (options.maxAccess !== undefined) {
		if (q.access === undefined) {
			q.access = {};
		}

		q.access.$lte = options.maxAccess;
	}

	if (options.minAccess !== undefined) {
		if (q.access === undefined) {
			q.access = {};
		}

		q.access.$gte = options.minAccess;
	}

	if (options.countryCode !== undefined) {
		q.countryCode = options.countryCode;
	}

	console.log(q);

	// Note: using lean() so that users is a JS obj, instead of a Mongoose obj
	User.find(q, 'access name email phones _id countryCode').lean().exec(
		function (err, users) {
		if (err) {
			cb(err);
		} else {
			for (var i = 0; i < users.length; i++) {
				users[i].country = countriesDictionary[users[i].countryCode];
			}

			cb(null, users);
		}
	});
};

function formatDate(rawDate) {
	return String(rawDate);
}

module.exports.legsToString = function (legs) {
	if (legs) {
		var report = '';

		for (var i = 0; i < legs.length; i++) {
			var leg = legs[i];
			report += 'Leg ' + (i + 1) + ': ' + leg.city + ', ' +
						leg.country + '\n';
			report += 'Description: ' + leg.description + '\n';
			report += 'Companions: ' + leg.companions + '\n';
			report += 'Contact: ' + leg.contact + '\n';
			report += 'Hotel: ' + leg.hotel + '\n';
			report += 'Date: ' + formatDate(leg.startDate) + ' - ' +
						formatDate(leg.endDate) + '\n';
			report += '\n';
		}

		return report;
	} else {
		return 'Invalid request data.';
	}
};

module.exports.sendEmail = function (sendFrom, sendTo, subject, text,
	callback) {
	var data = {
		from: sendFrom,
		to: sendTo,
		subject: subject,
		text: text,
	};

	if (dropEmail) {
		console.error('Email dropped. Email data:');
		console.error(data);
		if (callback) {
			callback();
		}
	} else {
		mailgun.messages().send(data, function (err, body) {
			console.log(body);

			if (callback) {
				callback();
			}
		});
	}
};

var sendTemplateEmail = function (sendFrom, sendTo, subject,
	template, map, callback) {

	var html = jade.renderFile(path.join(__dirname, '../email',
		template + '.jade'), map);

	var sendMimeCallback = function (sendError, body) {
		if (sendError) {
			console.log('was unable to send');
			console.log(sendError);
		}

		if (body) {
			console.log('Email data:' + body);
		}

		if (callback) {
			callback();
		}
	};

	var createMailCallback = function (sendTo, recipient) {
		return function (buildError, message) {
			if (buildError) {
				console.log(buildError);
			}

			var dataToSend = {
				to: sendTo[recipient],
				message: message.toString('ascii'),
			};

			mailgun.messages().sendMime(dataToSend, sendMimeCallback);
		};
	};

	for (var recipient in sendTo) {
		var data = {
			from: sendFrom,
			to: sendTo[recipient],
			subject: subject,
			html: html,
		};

		if (dropEmail) {
			console.error('Email dropped. Email data:');
			console.error(data);
			if (callback) {
				callback();
			}
		} else {
			var mail = mailcomposer(data);

			mail.build(createMailCallback(sendTo, recipient));
		}
	}
};

module.exports.sendTemplateEmail = sendTemplateEmail;

var sendSMS = function (sendTo, body, callback) {
	var data = {
		to: sendTo,
		from: process.env.BONVOYAGE_NUMBER,
		body: body,
	};

	if (dropSMS) {
		console.error('SMS dropped. SMS data:');
		console.error(data);
		if (callback) {
			callback();
		}
	} else {
		twilioClient.messages.create(data, function (err, message) {
			if (err) {
				console.log('Unable to send SMS');
			} else {
				console.log('Successfully sent SMS. SID is: ');
				console.log(message.sid);

				console.log('Sent on: ');
				console.log(message.dateCreated);
			}

			if (callback) {
				callback();
			}
		});
	}
};

module.exports.sendSMS = sendSMS;

module.exports.postComment = function (
	requestId, name, userId, commentMessage, cb) {
	Request.findByIdAndUpdate(requestId, {
		$push: {
			comments: {
				$each:[
					{
						name: name,
						user: userId,
						content: commentMessage,
					},
				],
			},
		},
	}, function (err) {
		cb(err);
	});

	// send notifications after comments are posted
	Request.findById(requestId, function (err, updatedRequest) {
		var staffId = updatedRequest.staff;
		var volunteerId = updatedRequest.volunteer;

		User.findById(volunteerId, function (err, volunteer) {
			if (err) {
				console.log(err);
				cb(err);
			}

			// notify the volunteer
			if (volunteer.phones) {
				for (var i = 0; i < volunteer.phones.length; i++) {
					sendSMS(volunteer.phones[i], 'Your BonVoyage ' +
						'leave request has been modified. Please review the' +
						' details at ' + process.env.BONVOYAGE_DOMAIN +
						'/requests/' + requestId);
				}
			}

			// notify the staff
			User.findById(staffId, function (err, staff) {
				if (err) {
					console.log(err);
					cb(err);
				}

				if (staff.phones) {
					for (var i = 0; i < staff.phones.length; i++) {
						sendSMS(staff.phones[i], 'A BonVoyage ' +
							'leave request for ' + volunteer.name +
							' has been updated. Please review the ' +
							'details at ' + process.env.BONVOYAGE_DOMAIN +
							'/requests/' + requestId);
					}
				}
			});
		});
	});
};

module.exports.formatDateOnly = function (date) {
	var dateonly = new DateOnly(parseInt(date + ''));
	var formatteddate = moment(dateonly.toDate()).format('MMM DD, YYYY');
	console.log(formatteddate);
	return formatteddate;
};

module.exports.fetchWarnings = function (callback) {
	Warning.find({}, function (err, warnings) {
		if (err) {
			console.error('An error occurred while fetching warnings:');
			console.error(err);
			return callback(err);
		} else {
			var countryToWarnings = {};

			for (var i = 0; i < warnings.length; i++) {
				var today = new DateOnly();
				if (!((warnings[i].startDate && today < warnings[i].startDate) ||
					(warnings[i].endDate && today > warnings[i].endDate))) {
					if (countryToWarnings[warnings[i].countryCode] === undefined) {
						countryToWarnings[warnings[i].countryCode] = [];
					}

					countryToWarnings[warnings[i].countryCode].push(warnings[i]);
				}
			}

			return callback(null, countryToWarnings);
		}
	});
};
