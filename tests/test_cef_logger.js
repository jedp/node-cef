var vows = require('vows');
var assert = require('assert');
var cef = require('../lib/cef');
var util = require('util');

// Dummy syslog transport; see test_syslog for syslog tests
var dummyTransport = function dummyTransport(message, callback) {
  if (callback) callback(null);
};

// Logger for use in macro tests
var logger = new cef.Logger(
  {
    vendor: 'Steinway',
    product: 'Piano',
    version: 'B',
    // don't send to syslog - see syslog tests for that
    syslog_transport: dummyTransport
  }
);

// macros for testing logging functions
function resultIs(expected) {
  return function(err, result) {
    assert.equal(expected, result);
  };
}

function produces(string) {
  var context = {
    topic: function() {
      var params = {
        name: "Out of tune",
        signature: "6/8",
      };
      return logger[this.context.name](params);
    }
  };

  context["works"] = resultIs(string);
  return context;
}

var suite = vows.describe("Logger")

.addBatch({
  "The logger": {
    topic: function() {
      var config = {
        vendor: 'Steinway',
        product: 'Piano',
        version: 'B',
        syslog_tag: 'test',
        syslog_facility: 'user',
        syslog_address: '127.0.0.1',
        syslog_port: 32767,
        syslog_transport: dummyTransport
      };
      return new cef.Logger(config);
    },

    "has a formatter": function(logger) {
      assert(typeof logger.formatter === 'object');
    },

    "has a properly configured syslogger": function(logger) {
      assert(logger.syslog.tag === 'test');
      assert(logger.syslog.facility === 1);
      assert(logger.syslog.address === '127.0.0.1');
      assert(logger.syslog.port === 32767);
      assert(logger.syslog.transport === dummyTransport);
    },

    "emergency": produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|10"),
    "alert":     produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|9"),
    "critical":  produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|8"),
    "error":     produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|7"),
    "warning":   produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|6"),
    "warn":      produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|6"),
    "notice":    produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|5"),
    "info":      produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|4"),
    "debug":     produces("CEF:0|Steinway|Piano|B|6/8|Out of tune|3")
  }
});

if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
