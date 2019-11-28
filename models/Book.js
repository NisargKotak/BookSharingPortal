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
    isActive : Boolean,
    canSell : Boolean,
    costOfBook : Number
});

BookSchema.index({bookName : 1});

BookSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('Book',BookSchema);