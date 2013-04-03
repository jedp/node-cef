var assert = require('assert');
var vows = require('vows');
var cef = require('../lib/cef');
var http = require('http');

var suite = vows.describe('HTTP Request Extensions');

// Macro for tests below
function contains(regex) {
  return function(err, result) {
    assert(regex.test(result));
  };
}

suite.addBatch({
  "Extensions from HTTP request": {
    topic: function() {
      // Create a logger
      var logger = new cef.Logger({
        vendor: 'John Masefield',
        product: 'Collected Works',
        version: 1
      });

      // Create a server that logs request
      var server = http.createServer(function(req, res) {
        this.callback(null, logger.info({
          signature: 1234,
          name: "I like pie!",
          extensions: cef.extensionsFromHTTPRequest(req)
        }));
        res.end();
        server.close();
      }.bind(this));

      // Once the server is listening, make a request
      server.listen(0, '127.0.0.1', function() {
        var req = http.request({
          port: server.address().port,
          host: '127.0.0.1',
          headers: {
            'user-agent': 'Dora the Internet Explora'
          }
        });
        req.end();
     });
    },

    "contain requestMethod":    contains(/requestMethod=\w+/),
    "contain request url":      contains(/request=\S+/),
    "contain destination host": contains(/dhost=\w+/),
    "contain client app name":  contains(/requestContext=\w+/),
    "contain hostname":         contains(/shost=\w+/)
  }

});

if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
