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
var count = 1;
Books.count({},function(err,cnt) {
    if(err) {
        console.log("LITE");
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
        {$match: {isActive:true}},
        { $lookup: {
                "localField" : "id",
                "from" : "books",
                "foreignField" : "id",
                "as" : "info"
            }},
        { $unwind: "$info" }
        ],function (err, books) {
            res.render('home',{books:books})
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
        notified : false,
        isActive : true
    }, function(err, newBook){
        if(err){
            // console.log("HELOOOOO");
            // console.log(count);
            // console.log(request.user.name);
            console.log(err);
        } else {
            //request.user.save();
            request.flash("success", newBook.bookName + " has been added to your list");
        }			
    });
    count++;
    response.redirect("/home");
});

app.post("/returnBook",isLoggedIn,function(req,res) {
    var bookId = Number(req.body.id);
    Transactions.find({id:bookId},function(err,book) {
        if(err) {
            console.log(err);
        } else {
            book[0].isActive = false;
            book[0].save();
            Books.find({id : bookId},function(err,returnedBook) {
                if(err) {
                    console.log(err);
                } else {
                    returnedBook[0].status = "Available";
                    returnedBook[0].notified = true;
                    returnedBook[0].save();
                }
            });
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
        res.render("search",{books:null});
    } else {
        // console.log("here");
        if(req.body.bookName !== "" && req.body.author !== "") {
            // console.log("here1");
            Books.find({bookName:req.body.bookName, author:req.body.author}, function(err,books) {
                res.render("search",{books:books});
            });
        } else if(req.body.bookName === "") {
            // console.log("here3");
            Books.find({author:req.body.author}, function(err,books) {
                res.render("search",{books:books});
            });
        } else if(req.body.author === "") {
            // console.log("here2");
            Books.find({bookName:req.body.bookName}, function(err,books) {
                res.render("search",{books:books});
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
                bookName : book[0].bookName,
                lenderName : book[0].owner,
                borrowerName : req.user.name,
                isActive : true,
                dateOFLending: Date.now(),
                dateOfReturning : (Date.now() + 7*24*60*60),
                id : book[0].id
            });
            // console.log(book[0].status);
            book[0].status = "Borrowed";
            book[0].notified = true;
            book[0].save();
        }
    });
    res.redirect("/home");
});



//Authentication Routes
app.get("/register", function(request, response){
	response.render("register");
});

app.post("/register", function(request, response){
	var newUser = new User({name: request.body.name, username: request.body.username, id: request.body.id});
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