var mongoose = require("mongoose");

mongoose.connect('mongodb://localhost:27017/bonvoyage');
mongoose.connection.on('error', function(err){
  if (err)
    console.log(err);
});

var User = require("../models/user");

var userbase = [
	{
		name: "Colin King",
		email: "colink@umd.edu",
		hash: "colin",
		access: 2
	},
	{
		name: "Sean Bae",
		email: "s@seanbae.net",
		hash: "sean",
		access: 2
	},
	{
		name: "Hiroshi Furuya",
		email: "tairabox@gmail.com",
		hash: "hiroshi",
		access: 2
	},
	{
		name: "Patrick Choquette",
		email: "pchoquette@peacecorps.gov",
		hash: "patrick",
		access: 1
	},
	{
		name: "Jane Smith",
		email: "jane@peacecorps.gov",
		hash: "jane",
		access: 1
	},
	{
		name: "John Doe",
		email: "john@test.com",
		hash: "john",
		access: 0
	},
	{
		name: "Ishaan Parikh‎",
		email: "ishaan@test.com",
		hash: "ishaan",
		access: 0
	},
	{
		name: "Jeff Hilnbrand",
		email: "jeff@test.com",
		hash: "jeff",
		access: 0
	},
];

var finished = 0;
for (var i = userbase.length - 1; i >= 0; i--) {
	var user = new User(userbase[i]);
	user.save(function(err) {
		if(err) console.error(err);
		else {
			finished += 1;
			if (finished == userbase.length) {
				console.log("Done.");
				mongoose.connection.close();
			}
		}
	})
};