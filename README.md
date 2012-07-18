# node-cef: A CEF and Syslog Logging Library

The Common Event Format, or CEF, is a [standard proposed by
ArcSight](http://www.arcsight.com/collateral/CEFstandards.pdf) for
logging event data.  This module provides a CEF formatter and logger
that by default emits messages to the syslog over udp.  The syslogger
is pluggable, so if the default does not fit your needs, you can
change it.

## Installation

```
npm install cef
```

## Example

```javascript
var cef = require('cef');

// Create a configuration for your application and your syslog interface
var config = {
  vendor: 'Steinway',
  product: 'Piano',
  version: 'B',
  syslog_tag: 'my-piano',
  syslog_facility: 'local4'
};

var logger = new cef.Logger(config);

logger.info({signature: "Bflat", name: "Out of tune"});
```

This will emit a message like the following to the system log:

```
<161> Jul 18 02:16:12 my-piano[17016] CEF:0|Steinway|Piano|B|Bflat|Out of tune|4
```

(I don't actually own a Steinway B, but I wish I did.)

## Logger Parameters

CEF requires log messages to have the following parameters:

- *Vendor*: A string identifying your organization
- *Product*: A string identifying your product
- *Version*: A string identifying the version of your product
- *Signature*: An arbitrary key identifying the type of event logged.  
  Typically a four-digit number.
- *Name*: A human-readable phrase describing the event.
- *Severity*: An integer between 0 (lowest) and 10 (highest severity)

Out of these six parameters, and also the CEF version number (0 at the
time of this writing), A cef string of the following form will be
constructed:

```
CEF:<cef_version>|<vendor>|<product>|<version>|<signature>|<name>|<severity>
```

Additionally, any number of key-value pairs specifying extra data can
be attached.  Such key value pairs are referred to as extensions.

The `node-cef` logger can be instantiated with any number of default
parameters, with the various logging methods specifying the remaining
required parameters.  For example:

```javascript
// Application config
var logger = new cef.Logger({
  vendor: "Initech",
  product: "Stapler",
  version: 2
});

logger.warn({
  signature: 42,
  name: "Attempted theft detected",
  extensions: {
    suser: "Milton",
    solution: "Burn it down!"
  }
});
```

Will log the following:

```
CEF:0|Initech|Stapler|2|42|Attempted theft detected|6|suser=Milton solution=Burn it down!
```

## CEF Levels and Syslog Severities

CEF defines 11 levels (0 to 10); syslog defines eight levels (0 to 7,
or debug to emerg).  To alighn these two, we declare CEF 11 to be
equivalent to syslog `emerg`, CEF 10 = syslog `alert`, and so on to
CEF 3 = syslog `debug`.  We do not use CEF levels 2, 1, or 0.

The `node-cef` logger has methods named after the syslog severities:

- `emergency()`
- `alert()`
- `critical()`
- `error()`
- `warning()` or `warn()`
- `notice()` (the default level for calling `log()`)
- `info()`
- `debug()`

We suggest you decide with your team on a set of meanings and stick
with them.  For example, for logging BrowserID events at Mozilla, we
use four levels as follows:

10. (`emerg`) Completely out of whack.  Someone needs to look at
    this.  Harm to the application, user account, or system security
    could have taken place.

8. (`alert`) Suspicious activity or application has non-validated user
   input. Impact is not known.

7. (`warn`) Normal security application stuff, login failures,
   password changes.

4. (`info`) Normal app activity.  Logins and various kinds of transactions.



## Syslog Transports

## Contributors

- [Yvan Boily](https://github.com/ygjb/cef) wrote the initial implementation.

- Patrick Huesler's [ain fork](https://github.com/phuesler/ain) provided the basis 
  for the syslog backend.
