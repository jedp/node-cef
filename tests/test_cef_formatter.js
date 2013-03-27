var vows = require('vows');
var assert = require('assert');
var Formatter = require('../lib/formatter');
var util = require('util');

function filter(method, expected, description) {
  var context = {
    topic: function() {
      this.callback(null, this.context.name);
    }
  };

  context["handles " + description] = function(err, input) {
    var formatter = new Formatter();
     assert(formatter[method](input) === expected);
  };
  return context;
}

function prefixFilter(expected, description) {
  return filter('sanitizePrefixField', expected, description);
}

function extensionFilter(expected, description) {
  return filter('sanitizeExtensionValue', expected, description);
}

var suite = vows.describe("Formatter")

.addBatch({
  "Sanitizing a null value": {
    topic: function() {
      return (new Formatter()).inputToString(null);
    },

    "yields 'null'": function(text) {
      assert(text === 'null');
    }
  },

  "Sanitizing an undefined value": {
    topic: function() {
      var foo = {};
      return (new Formatter()).inputToString(foo.undefined);
    },

    "yields 'undefined'": function(text) {
      assert(text === 'undefined');
    }
  },

  "Sanitizing an object": {
    topic: function() {
      var obj = {"I like": "pie"};
      return (new Formatter()).inputToString(obj);
    },

    "yields a valid JSON string": function(text) {
      assert(JSON.parse(text)["I like"] === "pie");
    }
  },

  "Sanitizing a number": {
    topic: function() {
      return (new Formatter()).inputToString(42);
    },

    "yields a string": function(text) {
      assert(typeof text === 'string');
      assert(text === "42");
    }
  },

  "Sanitizing in the prefix": {
    "eggman|walrus|": prefixFilter("eggman\\|walrus\\|", "pipes"),
    "C:\\blah\\blah": prefixFilter("C:\\\\blah\\\\blah", "backslashes"),
    "2+2=4, 4+4=8": prefixFilter("2+2=4, 4+4=8", "ingorable equals signs"),
    "|or else=": prefixFilter("\\|or else=", "escaped characters at string margins"),
    "I\r\n\r\nlike\r\r\rpie": prefixFilter("I    like   pie", "forbidden newlines")
  },

  "Sanitizing in an extension value": {
    "eggman|walrus|": extensionFilter("eggman|walrus|", "pipes"),
    "C:\\blah\\blah": extensionFilter("C:\\blah\\blah", "backslashes"),
    "2+2=4, 4+4=8": extensionFilter("2+2\\=4, 4+4\\=8", "equals signs"),
    "|or else=": extensionFilter("|or else\\=", "escaped characters at string margins"),
    "I\r\n\r\nlike\r\r\rpie": extensionFilter("I\n\nlike\n\n\npie", "newlines")
  }
})


.addBatch({
  "The format method": {
    topic: function() {
      var config = {
        vendor: "Initech",
        product: "Red Stapler",
        version: "2"
      };
      return new Formatter(config);
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
            rt: "Jun 12 2011 11:22:33",
            msg: "Foo=Bar"
          }
        };
        return formatter.format(params);
      },

      "produces a valid CEF string": function (err, result) {
        assert(!err);
        assert(result.indexOf("CEF:0|Initech|Red Stapler|2|17|Low on staples|6|") === 0);
        assert(result.indexOf("rt=Jun 12 2011 11:22:33") !== -1);
        assert(result.indexOf("msg=Foo\\=Bar") !== -1);
      }
    }
  }
})

.addBatch({
    "Extension formatting": {
        topic: function() {
          var config = {
            vendor: "Initech",
            product: "Red Stapler",
            version: "2",
            err_back: function(data, ctx) {
                this._global_error_back_data = data;
                this._global_error_back_ctx = ctx;
            }
          };
          return new Formatter(config);
        },

        "with invalid values": {
            topic: function(formatter) {
                var params = {
                  name: "Low on staples",
                  signature: "17",
                  severity: 6,
                  extensions: {
                    rt: "20130320",
                  }
                };
                return [formatter, formatter.format(params)];
            },

            "does not an error": function(err, result) {
                assert(!err);
                var formatter = result[0];
                var log_txt = result[1];

                var err_txt = "Not a valid value for rt: 20130320";
                assert(formatter._global_error_back_data === err_txt);
            }
        }
    }
})

.addBatch({
    "Extension formatting": {
        topic: function() {
          var config = {
            vendor: "Initech",
            product: "Red Stapler",
            version: "2",
            err_back: function(data, ctx) {
                this._global_error_back_data = data;
                this._global_error_back_ctx = ctx;
            }
          };
          return new Formatter(config);
        },

        "with invalid CEF or Arcsight keys": {
            topic: function(formatter) {
                var params = {
                  name: "Low on staples",
                  signature: "17",
                  severity: 6,
                  extensions: {
                    fdsart: "Jun 12 2011 11:22:33",
                  }
                };
                return [formatter, formatter.format(params)];
            },

            "does not throw an error": function(err, result) {
                assert(!err);
                var formatter = result[0];
                var log_txt = result[1];

                var err_txt = "Not a valid CEF or ArcSight key: fdsart";
                assert(formatter._global_error_back_data === err_txt);
            }
        }
    }
});


if (process.argv[1] === __filename) {
  suite.run();
} else {
  suite.export(module);
}
