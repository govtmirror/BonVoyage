/* jshint node: true */
'use strict';

var mongoose = require('mongoose');
var Access = require('../config/access');
var ipsum = require('lorem-ipsum');
var sprintf = require('sprintf-js').sprintf;
var moment = require('moment');
var fs = require('fs');
var DateOnly = require('dateonly');
var countryFilePath = '../public/data/countryList.json';
var countryListFile = fs.readFileSync(countryFilePath, 'utf8');
var countriesDictionary = JSON.parse(countryListFile);
var countryCodes = Object.keys(countriesDictionary);
var nCountries = countryCodes.length;
var User = require('../models/user');
var Request = require('../models/request');

var REQUESTS_TO_GENERATE = 100; // * Math.floor((50 * Math.random()));
var DRY_RUN = false;

mongoose.connect('mongodb://localhost:27017/bonvoyage');
mongoose.connection.on('error', function (err) {
	if (err) {
		console.log(err);
	}
});

function randIndex(length) {
	return Math.floor((Math.random() * length));
}

// Returns boolean with cutoff% likeliehood of being true
// Defaults to 0.5
function randBool(cutoff) {
	return Math.random() < (cutoff ? cutoff : 0.5);
}

function randCountryCode() {
	return countryCodes[randIndex(nCountries)];
}

function randDatePair() {
	var timeUntilLeave = randIndex(200) - 20;
	var start = moment();
	start.add(timeUntilLeave, 'days');
	var lengthOfVacation = randIndex(20);
	var end = moment(start);
	end.add(lengthOfVacation, 'days');
	return [new DateOnly(start), new DateOnly(end)];
}

function generateLeg() {
	var cc = randCountryCode();
	var dates = randDatePair();
	return {
		startDate: dates[0],
		endDate: dates[1],
		country: countriesDictionary[cc],
		countryCode: cc,
		hotel: ipsum(),
		contact: ipsum(),
		companions: ipsum(),
		description: ipsum(),
	};
}

function generateRequest(user) {
	var isPending = randBool(0.3);
	var isApproved = (isPending ? undefined : randBool(0.7));
	var legs = [];
	while (legs.length === 0 || randBool(0.4)) {
		legs.push(generateLeg());
	}

	return new Request({
		userId: user._id,
		status: {
			isPending: isPending,
			isApproved: isApproved,
		},
		legs: legs,
		comments: [],
	});
}

function saveAll(objects, cb) {
	var count = objects.length;
	var handleSave = function (err) {
		if (err) {
			console.error(err);
		} else {
			count -= 1;
			if (count % 5 === 0) {
				console.log(sprintf('%d requests left to save...', count));
			}

			if (count === 0) {
				cb();
			}
		}
	};

	for (var i = 0; i < objects.length; i++) {
		var object = objects[i];
		object.save(handleSave);
	}
}

console.log(sprintf('Generating %d requests...', REQUESTS_TO_GENERATE));

User.find({ access: Access.VOLUNTEER }, function (err, users) {
	if (err) {
		console.error(err);
	}

	var requests = [];
	for (var i = 0; i < REQUESTS_TO_GENERATE; i++) {
		var randUser = users[randIndex(users.length)];
		requests.push(generateRequest(randUser));
	}

	console.log(sprintf('About to save %d requests.', requests.length));

	if (DRY_RUN) {
		console.log(requests);
		mongoose.connection.close();
	} else {
		saveAll(requests, function () {
			console.log(sprintf('Finished saving.'));
			mongoose.connection.close();
		});
	}
});