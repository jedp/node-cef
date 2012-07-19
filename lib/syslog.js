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
 *
 * @param config
 *        (object)   Configuration parameters.  Can include:
 *
 *                   tag        (default __filename)
 *                   facility   (default 'user')
 *                   address    (default '127.0.0.1')
 *                   port       (default 514),
 *                   transport  (default transports.udp)
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

SysLogger.prototype = {
  /**
   * Send a message to the syslog
   *
   * @param message
   *        (string)    The message to log
   *
   * @param severity
   *        (number)    The syslog severity (0 = emerg .. 7 = debug)
   *
   * send() will prefix the message with facility+severity, the date,
   * the application tag, and the pid.
   */
  log: function send(message, severity) {
    if (typeof severity === 'string') {
      severity = SEVERITY[severity];
    }
    else if (typeof severity !== 'number') {
      severity = SEVERITY.notice;
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
};

/**
 * getInstance: get a singleton instance of the logger for a given config
 *
 * @param config
 *        (object)   The logger config (see SysLogger constructor)
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
