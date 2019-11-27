var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');

var TransactionsSchema = new mongoose.Schema({
    requestStatus : String,
    bookName : String,
    lenderName : String,
    borrowerName : String,
    isActive : Boolean,
    dateOfLending: Date,
    dateOfReturning : Date,
    id : Number
});

TransactionsSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('Transactions',TransactionsSchema);