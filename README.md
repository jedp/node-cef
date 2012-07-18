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

## Contributors

- [Yvan Boily](https://github.com/ygjb/cef) wrote the initial implementation.

- Patrick Huesler's [ain fork](https://github.com/phuesler/ain) provided the basis 
  for the syslog backend.
