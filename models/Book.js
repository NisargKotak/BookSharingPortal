var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');

var BookSchema = new mongoose.Schema({
    id : Number,
    bookName : String,
    author : String,
    edition : String,
    publisher : String,
    owner : String,
    status : String,
    notified : Boolean,
    isActive : Boolean,
});

BookSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('Book',BookSchema);