var express = require('express');
var app = express();
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require("passport-local");
var methodOverride = require("method-override");
var flash = require("connect-flash");
var User = require('./models/User');
var Transactions = require('./models/Transactions');
var Books = require('./models/Book');
var differenceInDays = require('date-fns/differenceInDays');
var count = 1;
var INITIAL_BALANCE = 100;
var PENALTY = 5;
var NO_OF_DAYS = 7;
var MIN_BALANCE = 20;
Books.count({},function(err,cnt) {
    if(err) {
        console.log(err);
    } else {
        count = cnt + 1;
    }
});

app.set("view engine","ejs");

app.use(bodyParser.urlencoded({extended: true}));
app.use(passport.initialize());
app.use('/css', express.static('css'));
app.use('/images', express.static('images'));
app.use(express.static(__dirname+"/public"));
app.use(methodOverride("_method"));
app.use(flash());


//Passport Configuration
app.use(require("express-session")({
	secret: "This is my first Web App",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Pass the User info 
app.use(function(request, response, next){
	response.locals.currentUser = request.user;
	response.locals.error = request.flash("error");
	response.locals.success = request.flash("success");
	next();
});

//connecting to database
mongoose.connect("mongodb://localhost:27017/BookSharingPortal",{useNewUrlParser : true, autoIndex : false});


//routes
app.get('/', function(req,res){
    res.render('login');
});

app.get('/home', isLoggedIn, function(req,res){
    Transactions.aggregate([
        { $match: { $or: [{ lenderName: req.user.name},{borrowerName: req.user.name}] }},
        {$sort : {dateOfLending:-1}},
        { $lookup: {
                "localField" : "id",
                "from" : "books",
                "foreignField" : "id",
                "as" : "info"
            }},
        { $unwind: "$info" }
        ],function (err, books) {
            var total=0;
            if(books.length>0)
            {
                books.filter(book => book.requestStatus==='Approved').forEach(book => {
                let cur = differenceInDays(Date.now(),book.dateOfLending);
                if(cur>NO_OF_DAYS && book.borrowerName===req.user.name)
                {
                    if(req.user.lastUpdatedOn < book.dateOfLending+ 7*24*60*60)
                        total+=PENALTY*(cur-NO_OF_DAYS);
                    else
                        total+=PENALTY*differenceInDays(Date.now(),req.user.lastUpdatedOn);
                }

                });
                User.find({name:req.user.name},function (err ,users) {
                    if(differenceInDays(Date.now(),users[0].lastUpdatedOn)>0)
                    {
                        users[0].deposit -= total;
                        users[0].lastUpdatedOn = Date.now();
                        users[0].save();
                    }
                    if(users[0].deposit<0)
                    {
                        req.flash("error","Your access has been revoked, Contact Administrator");
                        res.locals.error = req.flash("error");
                        res.render('login');
                    }
                    else if(users[0].deposit<=MIN_BALANCE)
                    {
                        if(total === 0)
                            req.flash("error", "Low Deposit");
                        else if(total>0)
                            req.flash("error", "Low Deposit and Return Books to avoid penalty");
                        res.locals.error = req.flash("error");
                        res.render('home',{books:books});
                    }
                    else if(total>0)
                    {
                        req.flash("error", "Return Books to avoid penalty");
                        res.locals.error = req.flash("error");
                        res.render('home',{books:books});
                    }
                    else
                    {
                        res.render('home',{books:books});
                    }
                });
            }
            else
            {
                res.render('home',{books:books});
            }
        }
    )
});

app.get("/addbook", isLoggedIn, function(request, response){
    response.render('addbook');
});

app.post("/addbook", function(request, response){
    Books.create({
        id : count,
        bookName : request.body.bookName,
        author : request.body.author,
        edition : request.body.edition,
        publisher : request.body.publisher,
        owner : request.user.name,
        status : "Available",
        isActive : true,
        canSell : request.body.canSell === "Yes",
        costOfBook : request.body.canSell === "Yes" && Number(request.body.costOfBook)
    }, function(err, newBook){
        if(err){
            console.log(err);
        } else {
            count++;
            request.flash("success", newBook.bookName + " has been added to your list");
            //request.user.save();
            // response.locals.success = request.flash("success");
            response.redirect("/home");
        }
    });

});

app.post("/returnBook",isLoggedIn,function(req,res) {
    var bookId = Number(req.body.id);
    Transactions.find({id:bookId},function(err,book) {
        if(err) {
            console.log(err);
        } else {
            book[0].requestStatus = "Returned";
            book[0].save();
            res.redirect("/home");
        }
    }).sort({dateOfLending:-1});
});

app.post("/receiveBook",isLoggedIn,function(req,res) {
    var bookId = Number(req.body.id);
    Transactions.find({id:bookId},function(err,book) {
        if(err) {
            console.log(err);
        } else {
            book[0].isActive = false;
            book[0].requestStatus = "Received";
            book[0].dateOfReturning = Date.now();
            book[0].save();
            Books.find({id : bookId},function(err,returnedBook) {
                if(err) {
                    console.log(err);
                } else {
                    returnedBook[0].status = "Available";
                    returnedBook[0].save();
                }
                res.redirect("/home");
            });
        }
    }).sort({dateOfLending:-1});
});

app.post("/lendBook",isLoggedIn,function(req,res) {
    var bookId = Number(req.body.id);
    Books.find({id : bookId},function(err,returnedBook) {
        if(err) {
            console.log(err);
        } else {
            returnedBook[0].status = req.body.status;
            returnedBook[0].save();

            Transactions.find({id:bookId},function (err, books) {
                if(req.body.status === "Available")
                {
                    books[0].isActive = false;
                    books[0].requestStatus = "Rejected";
                }
                else
                {
                    books[0].requestStatus = "Approved";
                    books[0].dateOfLending = Date.now();
                    books[0].dateOfReturning = Date.now() + 7*24*60*60;
                }
                books[0].save();
            }).sort({dateOfLending:-1})

        }
    });
    res.redirect("/home");
});

app.post("/sellBook",isLoggedIn,function(req,res) {
    var bookId = Number(req.body.id);
    Books.find({id : bookId},function(err,returnedBook) {
        if(err) {
            console.log(err);
        } else {
            if(req.body.status === "Sold")
            {
                returnedBook[0].isActive = false;
                returnedBook[0].status = "Sold";
            }
            else
            {
                returnedBook[0].status = "Available";
            }
            returnedBook[0].save();
            Transactions.find({id:bookId},function (err, books) {
                if(req.body.status === "Available")
                {
                    books[0].isActive = false;
                    books[0].requestStatus = "Rejected to Buy";
                }
                else
                {
                    books[0].isActive = false;
                    books[0].requestStatus = "Sold";
                    books[0].dateOfLending = Date.now();
                    books[0].dateOfReturning = Date.now() + 7*24*60*60;
                }
                books[0].save();
            }).sort({dateOfLending:-1})

        }
    });
    res.redirect("/home");
});

app.get("/search",isLoggedIn,function(req,res) {
    res.render("search",{books:null});
});

app.post("/search", function(req,res) {
    if(req.body.bookName === "" && req.body.author === "") {
        req.flash("error", "Please enter atleast one field");
        res.locals.error = req.flash("error");
        res.render("search",{books:null});
    } else {
        // console.log("here");
        if(req.body.bookName !== "" && req.body.author !== "") {
            // console.log("here1");
            Books.find({bookName:req.body.bookName, author:req.body.author, isActive:true}, function(err,books) {
                res.render("search",{books:books});
            });
        } else if(req.body.bookName === "") {
            // console.log("here3");
            Books.find({author:req.body.author, isActive:true}, function(err,books) {
                res.render("search",{books:books});
            });
        } else if(req.body.author === "") {
            // console.log("here2");
            Books.find({bookName:req.body.bookName, isActive:true}, function(err,books) {
                res.render("search",{books:books});
            });
        }
    }
});

app.get("/removeBook",isLoggedIn,function(req,res) {
    res.render("removeBook",{books:null});
});

app.post("/removeBook", function(req,res) {
    if(req.body.bookName === "" && req.body.author === "") {
        req.flash("error", "Please enter atleast one field");
        res.locals.error = req.flash("error");
        res.render("removeBook",{books:null});
    } else {
        // console.log("here");
        if(req.body.bookName !== "" && req.body.author !== "") {
            // console.log("here1");
            Books.find({bookName:req.body.bookName, author:req.body.author, isActive:true}, function(err,books) {
                res.render("removeBook",{books:books});
            });
        } else if(req.body.bookName === "") {
            // console.log("here3");
            Books.find({author:req.body.author, isActive:true}, function(err,books) {
                res.render("removeBook",{books:books});
            });
        } else if(req.body.author === "") {
            // console.log("here2");
            Books.find({bookName:req.body.bookName, isActive:true}, function(err,books) {
                res.render("removeBook",{books:books});
            });
        }
    }
});

app.post("/confirmDetails/:bookID", isLoggedIn, function(req,res) {
    Books.find({id: req.params.bookID}, function(err,book) {
        if(err) {
            console.log(err);
        } else {
            Transactions.create({
                requestStatus:"Requested",
                bookName : book[0].bookName,
                lenderName : book[0].owner,
                borrowerName : req.user.name,
                isActive : true,
                dateOfLending: Date.now(),
                id : book[0].id
            });
            // console.log(book[0].status);
            book[0].status = "Requested";
            book[0].save();
        }
    });
    res.redirect("/home");
});

app.post("/buyBook/:bookID", isLoggedIn, function(req,res) {
    Books.find({id: req.params.bookID}, function(err,book) {
        if(err) {
            console.log(err);
        } else {
            Transactions.create({
                requestStatus:"Requested to Buy",
                bookName : book[0].bookName,
                lenderName : book[0].owner,
                borrowerName : req.user.name,
                isActive : true,
                dateOfLending: Date.now(),
                id : book[0].id
            });
            // console.log(book[0].status);
            book[0].status = "Requested to Buy";
            book[0].save();
        }
    });
    res.redirect("/home");
});

app.post("/confirmRemoval/:bookID", isLoggedIn, function(req,res) {
    Books.find({id: req.params.bookID}, function(err,book) {
        if(err) {
            console.log(err);
        } else {
            // console.log(book[0].status);
            book[0].isActive = false;
            book[0].save();
        }
    });
    res.redirect("/removeBook");
});

//Authentication Routes
app.get("/register", function(request, response){
	response.render("register");
});

app.post("/register", function(request, response){
	var newUser = new User({name: request.body.name, username: request.body.username, id: request.body.id, deposit: INITIAL_BALANCE, lastUpdatedOn: Date.now()});
	User.register(newUser, request.body.password, function(err, user){
		if(err){
            console.log(err);
            request.flash("error", "That Username isn't available!");
            response.redirect("/register");
		} else {
			passport.authenticate("local")(request, response, function(){
				request.flash("success", request.body.name + ", you've been registered successfully!");
                response.redirect("/home");
			});
		}
	});
});

app.get("/login", function(request, response){
	response.render("login");
});

app.post("/login", passport.authenticate("local", 
	{
		successRedirect: "/home",
		failureRedirect: "/login"
	}), function(request, response){
});

app.get("/logout", function(request, response){
	request.logout();
	request.flash("success", "Logged you out!");
    response.redirect("/");
});

//temporary middleware
function isLoggedIn(request, response, next){
	if(request.isAuthenticated()){
		next();
	} else {
		request.flash("error", "Please Login First!");
        response.redirect("/login");
	}
}


// to check if password = confirm password field
// function correctPass(request, response, next){
// 	if(request.body.password==request.body.password2){
// 		next();
// 	} else {
// 		request.flash("error", "The passwords didn't match!");
// 		response.redirect("/register");
// 	}
// }

app.listen(3000, function(){
    console.log("Server running...");
});