/**
 * Common Event Format, or CEF, is a standard for event logging
 * proposed by ArcSight.
 *
 * http://www.arcsight.com/collateral/CEFstandards.pdf
 *
 * This module provides a logger that formats event data according to
 * the CEF standard and, by default, emits them to the syslog over
 * udp.  The logger backend is pluggable and can be changed if this
 * does not suit your needs.
 *
 * Please see the README.md file for usage.
 */

const os = require('os');
const util = require('util');
const dgram = require('dgram');
const syslog = require('./syslog');

const CURRENT_CEF_VERSION = "0";
const requiredParams = ['vendor', 'product', 'version', 'signature', 'name', 'severity'];
const sysLoggerOptions = [
  'syslog_tag',
  'syslog_facility',
  'syslog_address',
  'syslog_port',
  'syslog_transport'];

// RegExp objects for the formatter below
const SPECIAL_CHARS = new RegExp("([^\\\\])([\\|=]+)", "gm");
const INITIAL_SPECIAL_CHARS = new RegExp("^([\\|=]+)");
const NEWLINE_CHARS = new RegExp("([\r\n]+)", "gm");

// Seems reasonable to associate cef levels with syslog levels.
// cef goes from 0 .. 10, syslog has 8; so we align the top 8
// cef levels with syslog severities.
const EMERGENCY = 10,
      ALERT     =  9,
      CRITICAL  =  8,
      ERROR     =  7,
      WARNING   =  6,
      NOTICE    =  5,
      INFO      =  4,
      DEBUG     =  3;

// Valid syslog facilities are defined in RFC 3164:
const FACILITIES = {
  kern: 0,
  user: 1,
  mail: 2,
  daemon: 3,
  auth:   4,
  syslog: 5,
  lpr:    6,
  news:   7,
  uucp:   8,
  local0: 16,
  local1: 17,
  local2: 18,
  local3: 19,
  local4: 20,
  local5: 21,
  local6: 22,
  local7: 23
};

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
   * Convert a string to a legal CEF string
   *
   * @param text
   *        (string)    The text to filter
   *
   * The CEF v0 spec requires that:
   *
   * - pipes, backslashes, and equals signs in keys/values be escaped
   *
   * - newline character be either \r or \n, but not both.  Given the
   *   choice, we choose \n.
   *
   * This function is idempotent; when called on its own output, the
   * output will not be modified further.
   */
  sanitizeText: function sanitizeText(text) {
    // Make it a string
    text = text.toString();

    // Escape pipes, backslashes, and equals signs that have not
    // already been escaped.
    text = text.replace(SPECIAL_CHARS, "$1\\$2");

    // Escape any pipes, backslashes, and equals signs at the
    // beginning of the string
    text = text.replace(INITIAL_SPECIAL_CHARS, "\\$1");

    // Convert all newlines to \n
    text = text.replace(NEWLINE_CHARS, "\n");

    return text;
  },

  /**
   * Format a string to be used as a key in a list of extensions
   *
   * @param key
   *        (string)    The string to format
   *
   * Returns an escaped and formatted string.
   *
   * The CEF spec does not dictate the form of keys for extended
   * parameters beyond the implication that they may not contain
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

  /**
   * Format a string to be used as a value in a list of extensions.
   *
   * @param value
   *        (string)   The string to format
   *
   * Returns escaped and formatted string.
   */
  filterValue: function filterValue(value) {
    // make it a string
    value = this.sanitizeText(value);
    if (value.length > 1023) {
      value = value.slice(0, 1023);
    }
    return value;
  },

  /**
   * Format log message extensions
   *
   * @param extensions
   *        (object)    A dictionary of key/value pairs to format
   *
   * Returns a string like "key1=value1 key2=value2".  Whitespace in
   * values is preserved (with some possible modification of
   * newlines).
   */
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
   *                   severity:    <integer between 0 and 10 (least to most important)>}
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
  format: function format(params) {
    var err = null;
    var extensions = params.extensions;

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

var Logger = module.exports.Logger = function Logger(config) {
  // extract config options for SysLogger
  var syslogConfig = {};
  sysLoggerOptions.forEach(function(option) {
    if (config.hasOwnProperty(option)) {
      syslogConfig[option.split("_")[1]] = config[option];
    }
  });

  this.syslog = syslog.getInstance(syslogConfig);

  this.formatter = new Formatter(config);

  return this;
};

Logger.prototype = {
  log: function log(params, severity) {
    if (typeof severity === 'number') {
      params.severity = severity;
    }
    var message = this.formatter.format(params);

    if (severity >= 3) {
      // Map cef severity of 3..10 to syslog severity of 7..0
      // So 10 -> 0, 9 -> 1, ... 3 -> 7
      var syslogSeverity = 10 - severity;
      this.syslog.log(message, syslogSeverity);
    }

    return message;
  },

  emergency: function emerg(params) {
    return this.log(params, EMERGENCY);
  },

  alert: function alert(params) {
    return this.log(params, ALERT);
  },

  critical: function critical(params) {
    return this.log(params, CRITICAL);
  },

  error: function error(params) {
    return this.log(params, ERROR);
  },

  warning: function warning(params) {
    return this.log(params, WARNING);
  },
  warn: function warn(params) {
    return this.warning(params);
  },

  notice: function notice(params) {
    return this.log(params, NOTICE);
  },

  info: function info(params) {
    return this.log(params, INFO);
  },

  debug: function debug(params) {
    return this.log(params, DEBUG);
  }
};


/*
 * CEF Helpers
 * */

exports.extensionsFromHTTPRequest = function extensionsFromHTTPRequest(req) {
  return {
    requestMethod: req['method'],
    request: req.url,
	dest: req['headers']['host'],
	requestClientApplication: req['headers']['user-agent'],
	host: os.hostname()
  };
};
