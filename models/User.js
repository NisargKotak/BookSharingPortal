var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');

var UserSchema = new mongoose.Schema({
    name : String,
    id : String,
    password : String,
    username : String,
    deposit : Number,
    lastUpdatedOn : Date
});

UserSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('User',UserSchema);