"use strict";

var dateformat = require('dateformat');

// See the CEFstandards.pdf for definitions of these fields
var validCEFKeyNames = {
  // Standard CEF keys
  'act':     ["deviceAction",              'string'],
  'app':     ["applicationProtocol",       'string'],
  'in':      ["bytesIn",                   'integer'],
  'out':     ["bytesOut",                  'integer'],
  'dst':     ["destinationAddress",        'ipv4addr'],
  'dhost':   ["destinationHostName",       'fqdn'],
  'dmac':    ["destinationMacAddress",     'macaddr'],
  'dntdom':  ["destinationNtDomain",       'string'],
  'dpt':     ["destinationPort",           'portnum'],
  'dproc':   ["destionationProcessName",   'string'],
  'duid':    ["destinationUserId",         'string'],
  'dpriv':   ["destinationUserPrivileges", 'string'],
  'duser':   ["destinationUserName",       'string'],
  'end':     ["endTime",                   'timestamp'],
  'fname':   ["fileName",                  'string'],
  'fsize':   ["fileSize",                  'integer'],
  'msg':     ["message",                   'string'],
  'rt':      ["receiptTime",               'timestamp'],
  'request': ["requestURL",                'string'],
  'src':     ["sourceAddress",             'ipv4addr'],
  'shost':   ["sourceHostName",            'fqdn'],
  'smac':    ["sourceMacAddress",          'macaddr'],
  'sntdom':  ["sourceNtDomain",            'string'],
  'spt':     ["sourcePort",                'portnum'],
  'spriv':   ["sourceUserPrivileges",      'priv'],
  'suid':    ["sourceUserId",              'string'],
  'suser':   ["sourceUserName",            'string'],
  'start':   ["startTime",                 'timestamp'],
  'proto':   ["transportProtocol",         'string'],

  // There are 462 additional keys defined by ArcSight.
  // Here are a few:
  'requestMethod':   ['HTTPRequestMethod',  'string'],
  'requestContext':  ['UserAgent',          'string'],
};

var validators = module.exports.validators = {
  'string': function(input) {
    return true;
  },

  'integer': function(input) {
    // Careful about JS casting everything as ints and strings and hiding floats.
    if (/[\.]/.test(input)) {
      return false;
    }

    // Sloppy equals: can be valid int string as well as int
    return parseInt(input, 10) == input;
  },

  'ipv4addr': function(input) {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input);
  },

  'macaddr': function(input) {
    return /^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/.test(input);
  },

  'fqdn': function(input) {
    // meh.
    return /[\w\.]+/.test(input);
  },

  'portnum': function(input) {
    input = parseInt(input, 10);
    return (input >= 0 && input <= 65535);
  },

  'timestamp': function(input) {
    // The format is 'MMM dd yyyy HH:mm:ss' or milliseconds since epoch
    // (Jan 1st 1970).

    if (validators.integer(input)) {
      // Ensure that the datestamp is in milliseconds by testing that
      // it's greater than what I just got from running Date.now().
      return (input > 1342811763747);
    }

    return /^\w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2}$/.test(input);
  },

  'priv': function(input) {
    return ['Administrator', 'User', 'Guest'].indexOf(input) > -1;
  }
};

var validatorForKey = module.exports.validatorForKey = function validatorForKey (key) {
  var info = validCEFKeyNames[key];
  if (!info) {
    return null;
  }
  return validators[info[1]];
};
