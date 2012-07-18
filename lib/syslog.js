var util = require('util');
var dgram = require('dgram');
var dateformat = require('dateformat');
var Buffer = require('buffer').Buffer;

const DefaultAddress = "127.0.0.1";
const DefaultPort = 514;

/**
 * Transports take a formatted message and send it to your syslog
 */
var transports = {
  udp: function udpTransport(message, callback) {
    dgram.createSocket('udp4').send(
    new Buffer(message),
    0,
    message.length,
    this.port,
    this.address,
    callback);
  }
};

const DefaultTransport = transports.udp;

// Valid syslog facilities are defined in RFC 3164:
var FACILITY = {
  kern:    0,
  user:    1,
  mail:    2,
  daemon:  3,
  auth:    4,
  syslog:  5,
  lpr:     6,
  news:    7,
  uucp:    8,
  local0: 16,
  local1: 17,
  local2: 18,
  local3: 19,
  local4: 20,   // Default for browserid
  local5: 21,
  local6: 22,
  local7: 23
};

var SEVERITY = {
  emerg:  0,
  alert:  1,
  crit:   2,
  err:    3,
  warn:   4,
  notice: 5,
  info:   6,
  debug:  7
};

/**
 * Syslog logger
 * @constructor
 * @returns {SysLogger}
 */
function SysLogger(config) {
  this.tag = config.tag || __filename;

  if (typeof config.facility === 'string') {
    this.facility = FACILITY[config.facility];
  } else {
    this.facility = config.facility || FACILITY.user;
  }

  this.address = config.address || DefaultAddress;

  this.port = config.port || DefaultPort;

  if (typeof config.transport === 'function') {
    this.transport = config.transport;
  } else {
    this.transport = DefaultTransport;
  }

  return this;
}

/**
 * Send formatted message to syslog
 * @param {String} message
 * @param {Number|String} severity
 */
SysLogger.prototype = {
  send: function send(message, severity) {
    severity = severity || SEVERITY.notice;
    if (typeof severity === 'string'){
      severity = SEVERITY[severity];
    }

    // Format for syslog
    var formattedMessage = "<" + (this.facility * 8 + severity) + ">"
                         + " " + dateformat("mmm dd hh:MM:ss")
                         + " " + this.tag
                         + "[" + process.pid + "]"
                         + " " + message;

    // And send it
    this.transport(formattedMessage, function(err) {
      if (err) {
        console.error("ERROR: " + err + "  Failed to send message: " + message);
      }
    });
  },

  /**
   * Send log message with notice severity.
   */
  log: function log(message, severity) {
    this.send(message, SEVERITY.notice);
  }
};

/**
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
    instances[configKey] = new SysLogger(config);
  }
  return instances[configKey];
};

module.exports.getInstance = getInstance;
