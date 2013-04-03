var vows = require('vows');
var assert = require('assert');
var cef = require('../lib/cef');
var syslog = require('../lib/syslog');
var dgram = require('dgram');

var suite = vows.describe("SysLog")

.addBatch({
  "The syslog udp message": {
    topic: function() {
      // Create a udp server to mock syslog
      var server = dgram.createSocket('udp4');
      server.on('message', function(buf, rinfo) {
        server.close();
        this.callback(null, buf.toString());
      }.bind(this));

      // Log a message to it
      server.on('listening', function() {
        syslog.getInstance({port: server.address().port}).log("I like pie");
      });

      // find an open port
      server.bind(0);
    },

    "contains facility/severity": function(string) {
      assert(/^<\d+>/.test(string));
    },

    "contains the date": function(string) {
      assert(/<\d+> \w{3} \d{2} \d{2}:\d{2}:\d{2}/.test(string));
    },

    "contains the log message": function(string) {
      assert(/I like pie/.test(string));
    }
  }
})

.addBatch({
  "The syslog cef message": {
    topic: function() {
      // Create a udp server to mock syslog
      var server = dgram.createSocket('udp4');
      server.on('message', function(buf, rinfo) {
        server.close();
        this.callback(null, buf.toString());
      }.bind(this));

      // Log a message to it
      server.on('listening', function() {
        var config = {
          vendor: 'Foo',
          product: 'bar',
          version: '1.2.3',
          syslog_port: server.address().port,
          syslog_tag: 'night-kitchen',
          syslog_facility: 'local4'
        };
        new cef.Logger(config).info({
          name: "I like pie",
          signature: 1234
        });
      });

      // find an open port
      server.bind(0);
    },

    "contains the correct facility/severity": function(string) {
      assert(/^<166>/.test(string));
    },

    "contains the date": function(string) {
      assert(/<\d+> \w{3} \d{2} \d{2}:\d{2}:\d{2}/.test(string));
    },

    "contains the log message": function(string) {
      assert(/I like pie/.test(string));
    }
  }
});

if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
