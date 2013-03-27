var vows = require('vows');
var assert = require('assert');
var cef = require('../lib/cef');

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
        syslog_facility: 'local4',
        syslog_address: '192.168.1.42',
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
      assert(logger.syslog.facility === 20);
      assert(logger.syslog.address === '192.168.1.42');
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
}).

addBatch({
  "getInstance": {
    topic: function() {
      var config = {
        vendor: 'Foo',
        product: 'Bar',
        version: '0.1-baz'
      };
      return [config, cef.getInstance(config)];
    },

    "returns a singleton": function(tuple) {
      var config = tuple[0];
      var firstLogger = tuple[1];
      assert(cef.getInstance(config) === firstLogger);
      assert(cef.getInstance() !== firstLogger);
    }
  }
})

.addBatch({
  "creating a logger with no config": {
    topic: function() {
      return new cef.logger();
    },
    "doesn't crash": function(logger) {
      assert(logger);
    }
  },

  "creating a logger with a partial config": {
    topic: function() {
      return new cef.logger({vendor:'Blammo'});
    },
    "doesn't crash": function(logger) {
      assert(logger);
    }
  }
}).

addBatch({
  "creating a logger with custom err_back": {
    topic: function() {
        some_func = function(sample) {
            this._capture = sample;
        }
      var config = {
        vendor: 'Foo',
        product: 'Bar',
        version: '0.1-baz',
        err_back: some_func
      };
      return cef.getInstance(config);
    },

    "will override the built in err_back": function(result) {
      var logger = result;
      logger.err_back('foo');
      assert(logger._capture == 'foo');

      logger.formatter.err_back('bar');
      assert(logger.formatter._capture == 'bar');
    }
  }
}).

addBatch({
  "creating a logger with custom log_factory": {
    topic: function() {
        some_func = function(sample) {
            this._capture = sample;
        }
        custom_logfactory = function(syslog_config) {
            var mock_syslog = {
                log: function(message, severity) {
                    this._transport_capture_msg = message;
                    this._transport_capture_severity = severity;
                }
            }
            return mock_syslog;
        }
      var config = {
        vendor: 'Foo',
        product: 'Bar',
        version: '0.1-baz',
        log_factory: custom_logfactory
      };
      return cef.getInstance(config);
    },

    "will use the custom log_factory instead of std syslog": function(result) {
      var logger = result;
      logger.info({name: "i like pancakes", signature: "5432"});

      var expected_cef = "CEF:0|Foo|Bar|0.1-baz|5432|i like pancakes|4";
      var expected_severity = 6;

      assert(expected_cef === logger.syslog._transport_capture_msg);
      assert(expected_severity === logger.syslog._transport_capture_severity);
    }
  }
});



if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
