/**
 * http://www.arcsight.com/collateral/CEFstandards.pdf
 */

const os = require("os");
const util = require("util");
const SystemLogger = require("./syslog.js");

const CURRENT_CEF_VERSION = "0";
const requiredParams = ['vendor', 'product', 'version', 'signature', 'name', 'severity'];

var Formatter = module.exports.Formatter = function Formatter(config) {
  config = config || {};

  // Set default config for vendor, product, version
  this.vendor = config.vendor || "";
  this.product = config.product || "";
  this.version = config.version || "";

  return this;
};

Formatter.prototype = {
  /**
   * The CEF v0 spec requires that:
   *
   * - pipes, backslashes, and equals signs in keys/values be escaped
   * - newline character be either \r or \n; we choose \n
   */
  sanitizeText: function sanitizeText(text) {
    // Make it a string
    text = text.toString();

    // Escape pipes, backslashes, and equals signs
    text = text.replace(new RegExp("([\\|=]+)", "gm"), "\\$1");
    // Convert all newlines to \n
    text = text.replace(new RegExp("([\r\n]+)", "gm"), "\n");

    return text;
  },

  /**
   * The CEF spec does not dictate the form of keys for extended
   * parameters, other than the implication that they may not contain
   * spaces.
   */
  filterKey: function filterKey(key) {
    // make it a string
    key = this.sanitizeText(key);
    key = key.replace(/\s+/gm, "_");
    if (key.length > 1023) {
      key = k.slice(0, 1023);
    }
    return key;
  },

  /* values must:
   *  - escape \|=
   *  - collapse \r\ns into a single \r or \n;
   *    since the spec leaves us the choice, we collapse to \n
   *  - limit field length to 1023
   */
  filterValue: function filterValue(value) {
    // make it a string
    value = this.sanitizeText(value);
    if (value.length > 1023) {
      value = value.slice(0, 1023);
    }
    return value;
  },

  formatExtensions: function formatExtensions(extensions) {
    if (typeof extensions !== 'object') {
      return '';
    }

    // Convert extensions dictionary to a string like "food=pie barm=42"
    var extensionArray = [];
    Object.keys(extensions).forEach(function(key) {
      extensionArray.push(util.format("%s=%s",
                                      this.filterKey(key),
                                      this.filterValue(extensions[key])));
    }.bind(this));
    return extensionArray.join(" ");
  },

  /*
   * Accept set of prefix values and a set of extensions.  On error,
   * return an error object.  Otherwise return null and a formatted CEF
   * string.
   *
   * @param prefix
   *        (object)  A dictionary containing the six required prefix fields
   *                  and optional extensions dictionary.  The fields are:
   *
   *                  {cef_version: <integer version of the CEF format; default 0>,
   *                   vendor:      <string>,
   *                   product:     <string>,
   *                   version:     <string>,
   *                   signature:   <arbitrary event identifier>,
   *                   name:        <human-readable description of the event>,
   *                   severity:    <integer betwee 0 and 10 (least to most important)>}
   *
   * @param extensions
   *        (object)   Optional dictionary of additional key-value pairs.
   *
   * Vendor, product, and version should be unique.
   *
   * The resulting message will formatted with a pipe ("|") separating
   * each field in the prefix, and spaces separating each key-value pair
   * in the extensions, which will be joined with an equals sign ("=").
   *
   * For example:
   *
   *   format({vendor: "FooTech",
   *           product: "Frobulator",
   *           version: "42",
   *           signature: "1337",
   *           name: "Unmatched sock detected",
   *           severity: 6,
   *           extensions: {
   *             color: "red",
   *             size: "M",
   *           }});
   *
   * Would return:
   *
   *   "CEF:0|FooTech|Frobulator|42|1337|Unmatched sock detected|6|color=red size=M"
   *
   * In CEF lingo, the part of the string that does not include any
   * extended params is called the prefix.
   *
   */
  format: function format(params, extensions) {
    var err = null;

    // If none supplied, use default vendor, product, version
    if (! (params.vendor && params.product && params.version)) {
      params.vendor = this.vendor;
      params.product = this.product;
      params.version = this.version;
    }

    // Sanitize params
    Object.keys(params).forEach(function(key) {
      params[key] = this.filterValue(params[key]);
    }.bind(this));

    // Check that required params are present and contain a value.
    // If not, return an error.
    var paramKeys = Object.keys(params);
    requiredParams.forEach(function checkRequiredKeys(requiredKey) {
      if (paramKeys.indexOf(requiredKey) === -1) {
        err = new Error(util.format("Missing required key '%s' from params",
                                    requiredKey));
      }
    });
    if (err) {
      return (err);
    }

    // Check that severity is between 0 and 10.
    // If not, return an error.
    params.severity = parseInt(params.severity, 10);
    if (params.severity < 0 || params.severity > 10) {
      return new Error(utils.format("Illegal severity value: '%d'; must be [0..10]",
                                    params.severity));
    }

    var prefix = util.format("CEF:%s|%s|%s|%s|%s|%s|%s",
      CURRENT_CEF_VERSION,
	  params.vendor,
      params.product,
      params.version,
      params.signature,
      params.name,
      params.severity);

    if (extensions) {
      return null, [prefix, this.formatExtensions(extensions)].join("|");
    }
    return null, prefix;
  }
};


/*
 *
 */
var syslog = exports.syslog = function(signature, name, severity, environ, config, extensions, syslog)
{
  var cef = exports.generateCEF(signature, name, severity, environ, config, extensions);
  var logger = SystemLogger.getInstance();
  if (syslog != null) {
	logger.set(syslog);
  }
  logger.log(cef);
};

/* CEF Helpers */
exports.environFromHTTP = function(request) {
  return {requestMethod: request['method'],
          request: request.url,
	      dest: request['headers']['host'],
		  requestClientApplication: request['headers']['user-agent'],
		  host: os.hostname()};
};

exports.environFromParams = function(method, uri, host, agent) {
  return {requestMethod: method,
          request: uri,
          dest: host,
          requestClientApplication: agent,
          host: os.hostname()};
};
