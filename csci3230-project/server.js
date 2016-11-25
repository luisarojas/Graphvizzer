'use strict';
var express = require('express');
var exec = require('child_process').exec;
var bodyParser = require('body-parser');
var imgur = require('imgur');
var mongoose = require('mongoose');
var favicon = require('serve-favicon');
var fs = require('fs');
var config = require('./app/config.js');

var app = express();

const STATE_SUCCESS = 0;
const STATE_FAILURE = 1;

//connect to database
mongoose.connect('localhost:27017/userComments');

var Schema = mongoose.Schema;

var commentSchema = new Schema({username: {type:String,
										  required:true},
							   content: {type:String,
										required:true},
							   timestamp: String},
							   {collection: 'comments'});

var Comment = mongoose.model('comment', commentSchema);

function loadAllComments(req, res, error) {
	Comment.find().then(function(results) {
		console.log('Results for ALL comments: ' + results);
		res.send({allComments: results});			  
	});
}

app.use(favicon(__dirname + '/public/images/favicon.ico'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));

app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

app.get('/', function (req, res) {
    res.render('index', { title: 'Home', nav: 'home' });
});

app.get('/processDOT', function (req, res) {
    res.render('dot-input', { title: 'DOT', nav: 'dot' });
});

app.get('/reviews', function (req, res) {
    res.render('reviews', { title: 'Reviews', nav: 'review' });
});

app.get('/isAlive', function (req, res) {
    res.send('Yup, it\'s alive!');
});

app.post('/createImgurLinkForDOTString', require('./app/routes/createImgurLinkForDotString.js'));

app.get('/register', require('./app/routes/register.js'));

app.post('/processDOT', function (req, res) {
    console.log(req.body);

    const TEMPORARY_GRAPHVIZ_FILE_PATH = config.general.TEMPORARY_GRAPH_FILE_DIRECTORY + Date.now() + '.png';

    var command = 'echo "' + req.body.inputDOTString + '" | dot -Tpng -o ' + TEMPORARY_GRAPHVIZ_FILE_PATH;

    exec(command, function (error, stdout, stderr) {
        if (error) {
            console.log(error);
            res.send({
                state: STATE_FAILURE,
                message: 'Error processing your dot string'
            });
        }else {
            imgur.uploadFile(TEMPORARY_GRAPHVIZ_FILE_PATH)
                .then(function (result) {
                    var link = result.data.link;
                    console.log('Upload to Imgur succeeded. Link: ' + link);
                    res.send({
                        state: STATE_SUCCESS,
                        data: {
                            link: link
                        }
                    });
                })
                .catch(function (err) {
                    console.error('Error: ' + err.message);
                    res.send({
                        state: STATE_FAILURE,
                        message: 'Error while uploading to imgur'
                    });
                })
                .done(function () {
                    fs.unlink(TEMPORARY_GRAPHVIZ_FILE_PATH, function() {});
                });
        }
    });
});

app.get('/reviews', function (req, res) {
	res.render('reviews', {title: 'Reviews', nav:'review'});
});

app.post('/loadAllComments', function(req, res) {
	loadAllComments(req, res);
});

app.post('/submitNewComment', function(req, res) {
	
	var username = req.body.username;
	var commentContent = req.body.userInputComment;
	var timestamp = req.body.timestamp;

	//save comment locally
	var newComment = new Comment({username: username,
								 content: commentContent,
								 timestamp: timestamp});
	
	//add to database
	newComment.save(function(error) {
		if (error) {
			console.log(error);
			res.send({state:STATE_FAILURE,
					 message: 'Error processing your comment.'})
		} else {
			//loadAllComments(req, res);
			res.send({state:STATE_SUCCESS});
		}
	});
});

var server = app.listen(9000, function () {
    console.log('Listening on port 9000!');
});

module.exports = server;
