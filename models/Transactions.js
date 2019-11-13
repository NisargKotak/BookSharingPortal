var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');

var TransactionsSchema = new mongoose.Schema({
    bookName : String,
    lenderName : String,
    borrowerName : String,
    isActive : Boolean,
    dateOFLending: Date,
    dateOfReturning : Date,
    id : Number
});

TransactionsSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('Transactions',TransactionsSchema);