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
const syslog = require('./syslog');
const Formatter = require('./formatter');

const sysLoggerOptions = [
  'syslog_tag',
  'syslog_facility',
  'syslog_address',
  'syslog_port',
  'syslog_transport'];

const requiredOptions = [
  'vendor',
  'product',
  'version'
];

function ensureRequiredParams(config) {
  config = config || {};
  var missing = [];
  requiredOptions.forEach(function(option) {
    if (typeof config[option] === 'undefined') {
      config[option] = 'Unknown';
      missing.push(option);
    }
  });
  return {config: config, missing: missing};
}

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

var Logger = module.exports.Logger = function Logger(config) {
  var checkConfig = ensureRequiredParams(config);
  config = checkConfig.config;
  missingArgs = checkConfig.missing;

  // extract config options for SysLogger
  var syslogConfig = {};
  sysLoggerOptions.forEach(function(option) {
    if (config.hasOwnProperty(option)) {
      syslogConfig[option.split("_")[1]] = config[option];
    }
  });

  this.syslog = syslog.getInstance(syslogConfig);

  this.formatter = new Formatter(config);

  if (missingArgs.length !== 0) {
    this.warn({
      signature: 'node-cef',
      name: 'Missing parameters for new cef.Logger: ' + missingArgs.join(', ')
    });
  }

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

/**
 * getInstance: get a singleton instance of the logger for a given config
 *
 * @param config
 *        (object)   The logger config (see Logger constructor)
 *
 */
var instances = {};
var getInstance = function getInstance(config) {
  config = config || {};

  // make an instance key for this config
  var configKey = [];
  Object.keys(config).sort().forEach(function(key) {
    configKey.push(key + '=' + config[key]);
  });
  // stringify the array
  configKey = configKey.join(',');

  if (!instances[configKey]) {
    instances[configKey] = new Logger(config);
  }
  return instances[configKey];
};

module.exports.getInstance = getInstance;

/*
 * CEF Helpers
 * */

exports.extensionsFromHTTPRequest = function extensionsFromHTTPRequest(req) {
  return {
    request: req.url,
    requestMethod: req['method'],
	requestContext: req['headers']['user-agent'],
	dhost: req['headers']['host'],
	shost: os.hostname()
  };
};
