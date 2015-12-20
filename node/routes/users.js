var express = require('express');
var router = express.Router();
var User = require("../models/user");
var Request = require("../models/request");


router.renderLogin = function(req, res) {
	res.render('login.jade', {
		title: 'Login', 
		message: req.flash('loginMessage'), 
		links: [
			{ text: "Register", href: "/register" }
		]
	});
}

router.renderRegister = function(req, res) {
    res.render('register.jade', {
    	title: 'Register', 
    	message: req.flash('signupMessage'), 
		links: [
			{ text: "Login", href: "/login" }
		]
	});
}

router.renderSubform = function(req, res) {
    res.render('submission_form.jade', {
    	title: 'Submission Form',
    	links: [
    		{ text: "Dashboard", href: "/dashboard" }
    	]
    });
}

router.postLogout = function(req, res) {
	console.log("Logging out");
}

router.postRequests = function(req, res) {
	var d1 = req.body.leaving;
	var d2 = req.body.returning;
	var country = req.body.country;
	var description = req.body.reason;

	var newRequest = new Request({

		email: req.user.email,
		start_date: d1,
		end_date: d2,
		country: country,
		is_pending: true,
		is_approved: false,
		description: description

	});

	newRequest.save(function(err) {
		if (err)
			console.log(err);
		else
			console.log("success");
	});
}

router.renderVDash = function(req, res) {
	res.render('volunteer_dash.jade', {title: "Dash"});
}


router.getRequests = function(req, res){
	if (req.user && req.user.group === "bonvoyage") {
		Request.find(function (err, requests) {
		  if (err) return console.error(err);
		  res.json(requests);
		});

	} else if (req.user && req.user.group === "supervisor") {

		Request.find(function (err, requests) {
		  if (err) return console.error(err);
		  res.json(requests);
		});

	} else if (req.user && req.user.group === "volunteer") {
		Request.find({email: req.user.email}, function (err, requests) {
		  if (err) return console.error(err);
		  res.json(requests);
		});


	} else
      	res.send(401, 'Unauthorized');

};

module.exports = router;

