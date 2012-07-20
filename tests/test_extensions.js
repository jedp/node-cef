var vows = require('vows');
var assert = require('assert');
var extensions = require('../lib/extensions');
var util = require('util');

// macros for testing logging functions
function isValid(type) {
  var context = {
    topic: function() {
      return this.context.name;
    }
  };
  context["is a valid " + type] = function(type) {
    return function(err, input) {
      assert(extensions.validators[type](input));
    };
  };
  return context;
}

function isInvalid(type) {
  var context = {
    topic: function() {
      return this.context.name;
    }
  };
  context["is not a valid " + type] = function(type) {
    return function(err, input) {
      assert(! extensions.validators[type](input));
    };
  };
  return (context);
}

var suite = vows.describe("Extensions");

suite.addBatch({
  "delete": isValid("string"),
  "6789": isValid("integer"),
  "192.168.1.42": isValid("ipv4addr"),
  "http://jed.gov": isValid("fqdn"),
  "1A:2B:3C:4D:5E:6F": isValid("macaddr"),
  "32767": isValid("portnum"),
  "Jul 20 2012 12:20:02": isValid("timestamp"),
  "1342814344430": isValid("timestamp"),
  "Administrator": isValid("priv"),

  "123.0": isInvalid("integer"),
  "192.168.1.1234": isInvalid("ipv4addr"),
  "192.168.1": isInvalid("ipv4addr"),
  "1A:2B:3C:4D:5E": isInvalid("macaddr"),
  "1A:2B:3C:4D:5E:6F hi mom": isInvalid("macaddr"),
  "1a:2b:3c:4d:5e:6f": isInvalid("macaddr"),  // they seem to fuss over capitalization
  "Jul 1 2012 11:42:34": isInvalid("timestamp"),
  "Jul 01 2012 11:42:34 PM": isInvalid("timestamp"),
  "1342813700": isInvalid("timestamp"),
  "Bro": isInvalid("priv"),
  "65536": isInvalid("portnum"),
  "corn": isInvalid("portnum")
});

if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
