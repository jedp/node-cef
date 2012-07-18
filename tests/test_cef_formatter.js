var vows = require('vows');
var assert = require('assert');
var cef = require('../lib/cef');
var util = require('util');

var suite = vows.describe("Formatter")

.addBatch({
  "We escape": {
    topic: function() {
      return (new cef.Formatter()).sanitizeText("|I=flan\r|you=pie\r\n");
    },

    "pipes": function(text) {
      assert(! /[^\\]\|/.test(text));
    },

    "equals signs": function(text) {
      assert(! /[^\\]=/.test(text));
    },

    "backslashes": function(text) {
      assert(! /[^\\]\\[^|=]/.test(text));
    }
  },

  "The text sanitizer": {
    topic: function() {
      var formatter = new cef.Formatter();
      var f = formatter.sanitizeText;
      console.log("apply f: " + f("glug| merg"));
      return f(f(f("=I   | like pie = glug\r\n\r\r\n")));
    },

    "is idempotent": function(text) {
      assert(text === "\\=I   \\| like pie \\= glug\n");
    }
  },

  "The text sanitizer": {
    topic: function() {
      return (new cef.Formatter()).sanitizeText("|or else=");
    },

    "works on characters at string margins": function(text) {
      assert(text === "\\|or else\\=");
    }
  },

  "We collapse various newlines": {
    topic: function() {
      return (new cef.Formatter()).sanitizeText("I\r\n\r\nlike\r\r\rpie");
    },

    "to a single \n": function(text) {
      assert(text === "I\nlike\npie");
    }
  },

  "We ensure keys": {
    topic: function() {
       return (new cef.Formatter()).filterKey("I= like |\r\r\npie");
    },

    "are sanitized": function(text) {
      assert(! /[^\\]\|/.test(text));
    },

    "have no spaces": function(text) {
      assert (! /\s/.test(text));
    }
  },

  "We ensure values": {
    topic: function() {
      return (new cef.Formatter()).filterValue("this |must| be the place: 127.0.0.1\r\n\r\n");
    },

    "are escaped": function(text) {
      assert(! /[^\\]\|/.test(text));
    },

    "retain their spaces": function(text) {
      assert(/be the place/.test(text));
    },

    "have collapsed newlines": function(text) {
      assert(!/\r/.test(text));
      assert(/\n/.test(text));
      assert(!/\n\n/.test(text));
    }
  },

  "The format method": {
    topic: function() {
      var config = {
        vendor: "Initech",
        product: "Red Stapler",
        version: "2"
      };
      return new cef.Formatter(config);
    },

    "stores default values": function(formatter) {
      assert(formatter.vendor === "Initech");
      assert(formatter.product === "Red Stapler");
      assert(formatter.version === "2");
    },

    "given too few params": {
      topic: function(formatter) {
        return formatter.format({'name': 'Not enough params'});
      },

      "returns an error": function(_, err, result) {
        assert(!!err);
        assert(!result);
      },
    },

    "given enough params": {
      topic: function(formatter) {
        var params = {
          name: "Stolen!!",
          signature: "42",
          severity: 10
        };
        return formatter.format(params);
      },

      "returns a valid CEF string": function(err, result) {
        assert(!err);
        assert(result === 'CEF:0|Initech|Red Stapler|2|42|Stolen!!|10');
      }
    },

    "given more than enough params": {
      topic: function(formatter) {
        var params = {
          vendor: "Bob's Hardware",
          product: "Black Stapler",
          version: "X5000",
          name: "Stolen!!",
          signature: "42",
          severity: "10"
        };
        return formatter.format(params);
      },

      "will override default params": function(err, result) {
        assert(!err);
        assert(result === "CEF:0|Bob's Hardware|Black Stapler|X5000|42|Stolen!!|10");
      }
    },

    "given some but not all params to override": {
      topic: function(formatter) {
        // If we give product, we must also give vendor and number
        var params = {
          product: "Black Stapler",
          name: "Stolen!!",
          signature: "42",
          severity: "10"
        };
        return formatter.format(params);
      },

      "returns an error": function(_, err, result) {
        assert(err);
        assert(!result);
      }
    },

    "given extensions": {
      topic: function(formatter) {
        var params = {
          name: "Low on staples",
          signature: "17",
          severity: 6,
          extensions: {
            remaining: 32,
            failAt: "15min 42sec"
          }
        };
        return formatter.format(params);
      },

      "produces a valid CEF string": function (err, result) {
        assert(!err);
        assert(result.indexOf("CEF:0|Initech|Red Stapler|2|17|Low on staples|6|") === 0);
        assert(result.indexOf("remaining=32") !== -1);
        assert(result.indexOf("failAt=15min 42sec") !== -1);
      }
    }
  }
});

if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
