var dgram = require("dgram");
var os = require("os");
var util = require("util");
var SystemLogger = require("./syslog.js");

// We only emit CEF 0
var CEF_VERSION_STRING = "0";

function CEFException(message) {
  this.message = message == 'undefined' ? "Unknown CEF Exception" : message;
  this.name = "CEFException";
}

function sanitizeText(text) {
  // naively escape
  text.replace(/([^\\])([|]{1})/g,"$1\$2");
  // escape dangling \s
  text.replace(/([\\]{2})([=|]{1})/g,"$1\$2");
  // remove newlines
  text.replace(/([\r\n]+)/g, " ");
  return text;
}
function prefixFilter(prefix)
{
  return sanitizeText(util.format("%s", prefix));
}

/* restrict values to alphanumeric */
function keyFilter(key)
{
  var k = util.format("%s", key);
  k.replace(/([^a-zA-Z0-9])/g,"");
  if (k.length > 1023) {
    k = k.slice(0, 1023);
  }
  return k;
}

/* values must:
 *  - escape \|=
 *  - collapse \r\ns into a single \r or \n;
 *    since the spec leaves us the choice, we collapse to \n
 *  - limit field length to 1023
 */
function valueFilter(value) {
  var v = sanitizeText(util.format("%s", value));
  if (v.length > 1023) {
	v = v.slice(0, 1023);
  }
  // XXX trimming sanitized text could un-sanitize it
  // E.g., there could now be trailing | characters
  return v;
}

/**
 * Use @filter to extract the named @params from @source into @target.
 * Modifies @target in place.
 */
function extractNamedValues(target, source, params, filter) {
  // XXX should the logger be throwing exceptions?
  try {
	for (var i = 0; i < params.length; i++) {
	  target[params[i]] = filter(source[params[i]]);
	}
  } catch (err) {
	throw new CEFException("Unable to extract required keys (" + err + ")");
  }
}

function filterCEF(params)
{
  var prefix = {};

  // Extract Prefix Data
  extractNamedValues(prefix, params['config'], ['vendor', 'product', 'version'], prefixFilter);
  extractNamedValues(prefix, params, ['signature', 'severity', 'name'], prefixFilter);

  var severity = parseInt(prefix['severity'], 10);
  if ((typeof(severity) !== 'number')
      || (severity < 0)
      || (severity > 10)) {
    throw new CEFException("Invalid severity.");
  }

  // Extract Extensions (process environ first, allowing extensions to
  // clobber environment if the dev wants to)
  var extensions = {};
  [params['environ'], params['extensions']].forEach(function(extras) {
    Object.keys(extras).forEach(function(key) {
      extensions[keyFilter(key)] = valueFilter(extras[key]);
    });
  });

  return {prefix: prefix, extensions: extensions };
}

/*
 *	Accept set of prefix values, and a set of extensions, and emit a CEF entry.
 */
var formatCEF = exports.formatCEF = function(params) {
  var extension = "";
  for (var key in params['extensions']) {
	extension += util.format("%s=%s ", key, params['extensions'][key]);
  }
  // CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
  var prefix = params['prefix'];
  var cef = util.format("CEF:%s|%s|%s|%s|%s|%s|%s|%s",
      CEF_VERSION_STRING,
	  prefix['vendor'],
	  prefix['product'],
	  prefix['version'],
	  prefix['signature'],
	  prefix['name'],
	  prefix['severity'],
	  extension);

  return cef.toString("UTF-8");
};


/*
 * Writes a CEF entry to the object
 *  signature - a unique identifier used to identify the type of entry in ArcSight
 *  name - a text description of the event
 *  severity - a value between [0,10], 0 being lowest severity, and 10 the highest
 */
var generateCEF = exports.generateCEF = function(signature, name, severity, environ, config, extensions)
{
  try {
	var params = filterCEF(
      {config: config,
	   environ: environ,
	   extensions: extensions,
	   signature: signature,
	   name: name,
	   severity: severity});
  } catch (err) {
	throw new CEFException("Unable to extract parameters: " + err);
  }
  return formatCEF(params);
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
  try {
	return {requestMethod: request['method'],
			request: request.url,
			dest: request['headers']['host'],
			requestClientApplication: request['headers']['user-agent'],
			host: os.hostname()};
  } catch(err) {
	throw new CEFException("Unable to get request properties. (" + err + ")");
  }
};

exports.environFromParams = function(method, uri, host, agent) {
  return {requestMethod: method,
          request: uri,
          dest: host,
          requestClientApplication: agent,
          host: os.hostname()};
};
