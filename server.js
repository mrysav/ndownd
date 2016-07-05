var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var redis = require("redis");
var fs = require("fs");
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

app.get("/downloads", function(req, res) {
    var flist = fs.readdirSync(DOWNLOADS_DIRECTORY);
    var files = flist.filter(function(f) {
        return fs.statSync(DOWNLOADS_DIRECTORY + f).isFile()
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
    console.log("INFO: Download request received for " + message.split('/').pop());
});
listener.subscribe("downloads");