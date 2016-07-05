var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var redis = require("redis");
var fs = require("fs");
var http = require('https');
var listener = redis.createClient();
var notifier = redis.createClient();

// Note: you must have a trailing / at the end
var DOWNLOADS_DIRECTORY = __dirname + "/downloads/";

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
    console.log("ERROR: " + reason);
    res.status(code || 500).json({"error": (message || reason)});
}

// Shamelessly copied from
// http://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message);
  });
};

app.get("/downloads", function(req, res) {
    var flist = fs.readdirSync(DOWNLOADS_DIRECTORY);
    var files = flist.filter(function(f) {
        return fs.statSync(DOWNLOADS_DIRECTORY + f).isFile() && !f.startsWith('.');
    });
    res.status(200).json(files);
});

app.post("/downloads", function(req, res) {
    var url = req.body.url;
    if(!url) {
        handleError(res, "Null URL in request");
        return;
    }
    notifier.publish("downloads", url);
    res.status(200).json({"message": "Download added to queue"});
});

// Initialize the app.
var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("INFO: App now running on port", port);
});

// Worker for processing downloads
listener.on("message", function (channel, message) {
    // download file indicated by 'message' url here
    var filename = message.split('/').pop();
    console.log("INFO: Download request received for " + filename);
    download(message, DOWNLOADS_DIRECTORY + filename, function(e) {
        if(e) {
            console.log("ERROR: " + e)
        } else {
            console.log("INFO: Download for " + filename + " finished.");
        }
    });
});
listener.subscribe("downloads");