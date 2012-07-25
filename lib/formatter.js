const util = require('util');
const validatorForKey = require('./extensions').validatorForKey;

const CURRENT_CEF_VERSION = "0";
const requiredParams = ['vendor', 'product', 'version', 'signature', 'name', 'severity'];

var Formatter = module.exports = function Formatter(config) {
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
   * According to the CEF:0 spec, page 4:
   *
   * - Escape pipes (|) in the prefix, but not necessarily the
   *   extension.
   *
   * - Escape backslashes (\) in the prefix, but not necessarily the
   *   extension.
   *
   * - Escape equal signs (=) in the extensions, but not necessarily
   *   the prefix.
   *
   * - Multi-line fields can be sent by Common Event Format (CEF) by
   *   encoding the newline character as \n or \r. Multiple lines
   *   are only allowed in the value part of the extensions.
   *
   * Therefore we have two text sanitizers:
   *
   * - sanitizePrefixField()
   * - sanitizeExtensionValue()
   *
   * Extension keys belong to a predefined set.
   */
  inputToString: function inputToString(input) {
    if (typeof input === 'undefined' || typeof input === 'null') {
      return typeof input;
    }

    else if (typeof input === 'object') {
      return JSON.stringify(input, null, 2);
    }

    return input.toString();
  },

  /**
   * Escape pipes and backslashes in the prefix.  Equal signs are ok.
     Newlines are forbidden.
   */
  sanitizePrefixField: function sanitizePrefixField(input) {
    input = this.inputToString(input);
    var output = "";
    var nextChar = "";
    for (var i = 0; i < input.length; i++) {
      // A backslash is already escaping the next char?
      if (input[i] === "\\") {
        nextChar = input[i+1];
        if (/[\\|]/.test(nextChar)) {
          output += "\\" + nextChar;
          i += 1;
        } else {
          output += "\\\\";
        }

      // An unescaped backslash or pipe?
      } else if (/[\\|]/.test(input[i])) {
        if (input[i-1] !== '\\') {
          output += "\\" + input[i];
        }

      // Replace newlines with a space to maintain some legibility
      } else if (/[\r\n]/.test(input[i])) {
        output += " ";

      } else {
        output += input[i];
      }
    }
    return output;
  },

  /**
   * Escape equal signs in the extensions.  Canonicalize newlines.
   * CEF spec leaves it up to us to choose \r or \n for newline.
   * We choose \n as the default.
   */
  sanitizeExtensionValue: function sanitizeExtensionValue(input) {
    input = this.inputToString(input);
    var output = "";
    for (var i = 0; i < input.length; i++) {
      // Escape equal signs
      if (input[i] === "=") {
        if (input[i-1] !== "\\") {
          output += "\\" + input[i];
        } else {
          output += input[i];
        }

      // Canonicalize whitespace
      } else if (input[i] === "\r") {
        // convert \r\n to \n
        if (input[i+1] === "\n") {
          output += "\n";
          i += 1;
        // convert plain \r to \n
        } else {
          output += "\n";
        }

      } else {
        output += input[i];
      }
    }

    return output;
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
    var value = "";
    var validator = null;
    Object.keys(extensions).forEach(function(key) {
      validator = validatorForKey(key);
      if (validator) {
        value = extensions[key];
        if (validator(value)) {
          extensionArray.push(util.format("%s=%s", key, this.sanitizeExtensionValue(value)));
        } else {
          console.error(util.format("Not a valid value for %s: %s", key, value));
        }
      } else {
        console.error("Not a valid CEF or ArcSight key: " + key);
      }
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

    // Check that required params are present and contain a value.
    // If not, return an error.
    var paramKeys = Object.keys(params);
    requiredParams.forEach(function checkRequiredKeys(requiredKey) {
      if (paramKeys.indexOf(requiredKey) === -1) {
        err = new Error(util.format("Missing required key '%s' from params",
                                    requiredKey));
      } else {
        // Sanitize prefix fields
        params[requiredKey] = this.sanitizePrefixField(params[requiredKey]);
      }
    }.bind(this));
    if (err) {
      return (err);
    }

    // Check that severity is between 0 and 10.
    // If not, return an error.
    params.severity = parseInt(params.severity, 10);
    if (params.severity < 0 || params.severity > 10) {
      return new Error(util.format("Illegal severity value: '%d'; must be [0..10]",
                                   params.severity));
    }

    // Build the CEF prefix
    var output = util.format("CEF:%s|%s|%s|%s|%s|%s|%s",
      CURRENT_CEF_VERSION,
	  params.vendor,
      params.product,
      params.version,
      params.signature,
      params.name,
      params.severity);

    // Add any extensions
    if (extensions) {
      // The formatExtensions function will sanitize values
      output += "|" + this.formatExtensions(extensions);
    }

    // Be conservative and truncate strings over 1023 chars.
    if (output.length > 1023) {
      output = output.slice(0, 1023);
    }

    return null, output;
  }
};
