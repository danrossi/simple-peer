(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.SimplePeer = {}));
}(this, (function (exports) { 'use strict';

	/**
	 * Event Emitter
	 * @author Electroteque Media Daniel Rossi <danielr@electroteque.org>
	 * Copyright (c) 2016 Electroteque Media
	 */

	//import _Map from "babel-runtime/core-js/map";
	//import 'babel-polyfill';

	/**
	 * Creates a new instance of Emitter.
	 * @class
	 * @returns {Object} emitter - An instance of Emitter.
	 * @example
	 * var emitter = new Emitter();
	 */

	const objectToEvents = new WeakMap();

	class EventEmitter {

	    constructor() {
	        objectToEvents.set(this, {});
	    }

	    /**
	     * Adds a listener to the collection for a specified event.
	     * @public
	     * @function
	     * @name Emitter#on
	     * @param {String} event - Event name.
	     * @param {Function} listener - Listener function.
	     * @returns {Object} emitter
	     * @example
	     * emitter.on('ready', listener);
	     */
	    on(type, callback) {

	        const events = objectToEvents.get(this);

	        if (!events[type]) {
	            events[type] = [];
	        }
	        events[type].push(callback);

	        return this;
	    }

	    /**
	     * Adds a one time listener to the collection for a specified event. It will execute only once.
	     * @public
	     * @function
	     * @name Emitter#once
	     * @param {String} event - Event name.
	     * @param {Function} listener - Listener function.
	     * @returns {Object} emitter
	     * @example
	     * me.once('contentLoad', listener);
	     */
	    once(type, callback) {

	        const fn = (...args) => {
	            this.off(type, fn);
	            callback(...args);
	        };

	        this.on(type, fn);

	        return this;
	    }

	    /**
	     * Removes a listener from the collection for a specified event.
	     * @public
	     * @function
	     * @name Emitter#off
	     * @param {String} event - Event name.
	     * @param {Function} listener -  Listener function.
	     * @returns {Object} emitter
	     * @example
	     * me.off('ready', listener);
	     */
	    off(type, callback) {

	        const events = objectToEvents.get(this)[type];

	        if (events) {
	            if (callback === null) {
	                events.length = 0;
	            } else {
	                events.splice(events.indexOf(callback), 1);
	            }
	        }


	        /*let index = 0;

	        function isFunction(obj) {
	            return typeof obj === 'function' || false;
	        }

	        if (listeners && listeners.length) {

	            index = listeners.reduce((lastIndex, listener, currentIndex) => {
	                return isFunction(listener) && listener === callback ? lastIndex = currentIndex : lastIndex;
	            }, -1);


	            if (index > -1) {
	                listeners.splice(index, 1);
	                this.listeners.set(event, listeners);
	            }
	        }*/
	        return this;
	    }

	    /**
	     * Returns all listeners from the collection for a specified event.
	     * @public
	     * @function
	     * @name Emitter#listeners
	     * @param {String} event - Event name.
	     * @returns {Array}
	     * @example
	     * me.listeners('ready');
	     */
	    listeners(type) {
	        try {
	            return objectToEvents.get(this)[type];
	        } catch (error) {
	            return null;
	        }
	    }

	    /**
	     * Execute each item in the listener collection in order with the specified data.
	     * @name Emitter#emit
	     * @public
	     * @function
	     * @param {String} event - The name of the event you want to emit.
	     * @param {...args} [args] - Data to pass to the listeners.
	     * @example
	     * me.emit('ready', 'param1', {..}, [...]);
	     */
	    emit(type, ...args) {

	        //const event, events;

	        //events = (objectToEvents.get(this)[type] || []).slice();

	        const events = objectToEvents.get(this)[type];

	        if (events && events.length) {
	            events.forEach((listener) => {
	                listener({ type: type, target: this}, ...args);
	            });
	            return true;
	        }

	        return this;
	    }

	    emitAsync(type, ...args) {
	        //const listeners = this.listeners.get(event),
	        const events = objectToEvents.get(this)[type],
	            promises = [];


	        if (events && events.length) {
	            events.forEach((listener) => {
	                promises.push(listener({ type: type, target: this}, ...args));
	            });
	        }

	        return Promise.all(promises);
	    }

	}

	const grammar = {
	  v: [{
	    name: 'version',
	    reg: /^(\d*)$/,
	    format: '%s'
	  }],
	  o: [{
	    // o=- 20518 0 IN IP4 203.0.113.1
	    // NB: sessionId will be a String in most cases because it is huge
	    name: 'origin',
	    reg: /^(\S*) (\d*) (\d*) (\S*) IP(\d) (\S*)/,
	    names: ['username', 'sessionId', 'sessionVersion', 'netType', 'ipVer', 'address'],
	    format: '%s %s %d %s IP%d %s'
	  }],
	  // default parsing of these only (though some of these feel outdated)
	  s: [{ name: 'name', reg: /(.*)/, format: '%s' }],
	  i: [{ name: 'description', reg: /(.*)/, format: '%s' }],
	  u: [{ name: 'uri', reg: /(.*)/, format: '%s' }],
	  e: [{ name: 'email', reg: /(.*)/, format: '%s' }],
	  p: [{ name: 'phone', reg: /(.*)/, format: '%s' }],
	  z: [{ name: 'timezones', reg: /(.*)/, format: '%s' }], // TODO: this one can actually be parsed properly...
	  r: [{ name: 'repeats', reg: /(.*)/, format: '%s' }],   // TODO: this one can also be parsed properly
	  // k: [{}], // outdated thing ignored
	  t: [{
	    // t=0 0
	    name: 'timing',
	    reg: /^(\d*) (\d*)/,
	    names: ['start', 'stop'],
	    format: '%d %d'
	  }],
	  c: [{
	    // c=IN IP4 10.47.197.26
	    name: 'connection',
	    reg: /^IN IP(\d) (\S*)/,
	    names: ['version', 'ip'],
	    format: 'IN IP%d %s'
	  }],
	  b: [{
	    // b=AS:4000
	    push: 'bandwidth',
	    reg: /^(TIAS|AS|CT|RR|RS):(\d*)/,
	    names: ['type', 'limit'],
	    format: '%s:%s'
	  }],
	  m: [{
	    // m=video 51744 RTP/AVP 126 97 98 34 31
	    // NB: special - pushes to session
	    // TODO: rtp/fmtp should be filtered by the payloads found here?
	    reg: /^(\w*) (\d*) ([\w/]*)(?: (.*))?/,
	    names: ['type', 'port', 'protocol', 'payloads'],
	    format: '%s %d %s %s'
	  }],
	  a: [
	    {
	      // a=rtpmap:110 opus/48000/2
	      push: 'rtp',
	      reg: /^rtpmap:(\d*) ([\w\-.]*)(?:\s*\/(\d*)(?:\s*\/(\S*))?)?/,
	      names: ['payload', 'codec', 'rate', 'encoding'],
	      format: function (o) {
	        return (o.encoding)
	          ? 'rtpmap:%d %s/%s/%s'
	          : o.rate
	            ? 'rtpmap:%d %s/%s'
	            : 'rtpmap:%d %s';
	      }
	    },
	    {
	      // a=fmtp:108 profile-level-id=24;object=23;bitrate=64000
	      // a=fmtp:111 minptime=10; useinbandfec=1
	      push: 'fmtp',
	      reg: /^fmtp:(\d*) ([\S| ]*)/,
	      names: ['payload', 'config'],
	      format: 'fmtp:%d %s'
	    },
	    {
	      // a=control:streamid=0
	      name: 'control',
	      reg: /^control:(.*)/,
	      format: 'control:%s'
	    },
	    {
	      // a=rtcp:65179 IN IP4 193.84.77.194
	      name: 'rtcp',
	      reg: /^rtcp:(\d*)(?: (\S*) IP(\d) (\S*))?/,
	      names: ['port', 'netType', 'ipVer', 'address'],
	      format: function (o) {
	        return (o.address != null)
	          ? 'rtcp:%d %s IP%d %s'
	          : 'rtcp:%d';
	      }
	    },
	    {
	      // a=rtcp-fb:98 trr-int 100
	      push: 'rtcpFbTrrInt',
	      reg: /^rtcp-fb:(\*|\d*) trr-int (\d*)/,
	      names: ['payload', 'value'],
	      format: 'rtcp-fb:%d trr-int %d'
	    },
	    {
	      // a=rtcp-fb:98 nack rpsi
	      push: 'rtcpFb',
	      reg: /^rtcp-fb:(\*|\d*) ([\w-_]*)(?: ([\w-_]*))?/,
	      names: ['payload', 'type', 'subtype'],
	      format: function (o) {
	        return (o.subtype != null)
	          ? 'rtcp-fb:%s %s %s'
	          : 'rtcp-fb:%s %s';
	      }
	    },
	    {
	      // a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
	      // a=extmap:1/recvonly URI-gps-string
	      // a=extmap:3 urn:ietf:params:rtp-hdrext:encrypt urn:ietf:params:rtp-hdrext:smpte-tc 25@600/24
	      push: 'ext',
	      reg: /^extmap:(\d+)(?:\/(\w+))?(?: (urn:ietf:params:rtp-hdrext:encrypt))? (\S*)(?: (\S*))?/,
	      names: ['value', 'direction', 'encrypt-uri', 'uri', 'config'],
	      format: function (o) {
	        return (
	          'extmap:%d' +
	          (o.direction ? '/%s' : '%v') +
	          (o['encrypt-uri'] ? ' %s' : '%v') +
	          ' %s' +
	          (o.config ? ' %s' : '')
	        );
	      }
	    },
	    {
	      // a=extmap-allow-mixed
	      name: 'extmapAllowMixed',
	      reg: /^(extmap-allow-mixed)/,
	      format: '%s'
	    },
	    {
	      // a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:PS1uQCVeeCFCanVmcjkpPywjNWhcYD0mXXtxaVBR|2^20|1:32
	      push: 'crypto',
	      reg: /^crypto:(\d*) ([\w_]*) (\S*)(?: (\S*))?/,
	      names: ['id', 'suite', 'config', 'sessionConfig'],
	      format: function (o) {
	        return (o.sessionConfig != null)
	          ? 'crypto:%d %s %s %s'
	          : 'crypto:%d %s %s';
	      }
	    },
	    {
	      // a=setup:actpass
	      name: 'setup',
	      reg: /^setup:(\w*)/,
	      format: 'setup:%s'
	    },
	    {
	      // a=connection:new
	      name: 'connectionType',
	      reg: /^connection:(new|existing)/,
	      format: 'connection:%s'
	    },
	    {
	      // a=mid:1
	      name: 'mid',
	      reg: /^mid:([^\s]*)/,
	      format: 'mid:%s'
	    },
	    {
	      // a=msid:0c8b064d-d807-43b4-b434-f92a889d8587 98178685-d409-46e0-8e16-7ef0db0db64a
	      name: 'msid',
	      reg: /^msid:(.*)/,
	      format: 'msid:%s'
	    },
	    {
	      // a=ptime:20
	      name: 'ptime',
	      reg: /^ptime:(\d*)/,
	      format: 'ptime:%d'
	    },
	    {
	      // a=maxptime:60
	      name: 'maxptime',
	      reg: /^maxptime:(\d*)/,
	      format: 'maxptime:%d'
	    },
	    {
	      // a=sendrecv
	      name: 'direction',
	      reg: /^(sendrecv|recvonly|sendonly|inactive)/,
	      format: '%s'
	    },
	    {
	      // a=ice-lite
	      name: 'icelite',
	      reg: /^(ice-lite)/,
	      format: '%s'
	    },
	    {
	      // a=ice-ufrag:F7gI
	      name: 'iceUfrag',
	      reg: /^ice-ufrag:(\S*)/,
	      format: 'ice-ufrag:%s'
	    },
	    {
	      // a=ice-pwd:x9cml/YzichV2+XlhiMu8g
	      name: 'icePwd',
	      reg: /^ice-pwd:(\S*)/,
	      format: 'ice-pwd:%s'
	    },
	    {
	      // a=fingerprint:SHA-1 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33
	      name: 'fingerprint',
	      reg: /^fingerprint:(\S*) (\S*)/,
	      names: ['type', 'hash'],
	      format: 'fingerprint:%s %s'
	    },
	    {
	      // a=candidate:0 1 UDP 2113667327 203.0.113.1 54400 typ host
	      // a=candidate:1162875081 1 udp 2113937151 192.168.34.75 60017 typ host generation 0 network-id 3 network-cost 10
	      // a=candidate:3289912957 2 udp 1845501695 193.84.77.194 60017 typ srflx raddr 192.168.34.75 rport 60017 generation 0 network-id 3 network-cost 10
	      // a=candidate:229815620 1 tcp 1518280447 192.168.150.19 60017 typ host tcptype active generation 0 network-id 3 network-cost 10
	      // a=candidate:3289912957 2 tcp 1845501695 193.84.77.194 60017 typ srflx raddr 192.168.34.75 rport 60017 tcptype passive generation 0 network-id 3 network-cost 10
	      push:'candidates',
	      reg: /^candidate:(\S*) (\d*) (\S*) (\d*) (\S*) (\d*) typ (\S*)(?: raddr (\S*) rport (\d*))?(?: tcptype (\S*))?(?: generation (\d*))?(?: network-id (\d*))?(?: network-cost (\d*))?/,
	      names: ['foundation', 'component', 'transport', 'priority', 'ip', 'port', 'type', 'raddr', 'rport', 'tcptype', 'generation', 'network-id', 'network-cost'],
	      format: function (o) {
	        var str = 'candidate:%s %d %s %d %s %d typ %s';

	        str += (o.raddr != null) ? ' raddr %s rport %d' : '%v%v';

	        // NB: candidate has three optional chunks, so %void middles one if it's missing
	        str += (o.tcptype != null) ? ' tcptype %s' : '%v';

	        if (o.generation != null) {
	          str += ' generation %d';
	        }

	        str += (o['network-id'] != null) ? ' network-id %d' : '%v';
	        str += (o['network-cost'] != null) ? ' network-cost %d' : '%v';
	        return str;
	      }
	    },
	    {
	      // a=end-of-candidates (keep after the candidates line for readability)
	      name: 'endOfCandidates',
	      reg: /^(end-of-candidates)/,
	      format: '%s'
	    },
	    {
	      // a=remote-candidates:1 203.0.113.1 54400 2 203.0.113.1 54401 ...
	      name: 'remoteCandidates',
	      reg: /^remote-candidates:(.*)/,
	      format: 'remote-candidates:%s'
	    },
	    {
	      // a=ice-options:google-ice
	      name: 'iceOptions',
	      reg: /^ice-options:(\S*)/,
	      format: 'ice-options:%s'
	    },
	    {
	      // a=ssrc:2566107569 cname:t9YU8M1UxTF8Y1A1
	      push: 'ssrcs',
	      reg: /^ssrc:(\d*) ([\w_-]*)(?::(.*))?/,
	      names: ['id', 'attribute', 'value'],
	      format: function (o) {
	        var str = 'ssrc:%d';
	        if (o.attribute != null) {
	          str += ' %s';
	          if (o.value != null) {
	            str += ':%s';
	          }
	        }
	        return str;
	      }
	    },
	    {
	      // a=ssrc-group:FEC 1 2
	      // a=ssrc-group:FEC-FR 3004364195 1080772241
	      push: 'ssrcGroups',
	      // token-char = %x21 / %x23-27 / %x2A-2B / %x2D-2E / %x30-39 / %x41-5A / %x5E-7E
	      reg: /^ssrc-group:([\x21\x23\x24\x25\x26\x27\x2A\x2B\x2D\x2E\w]*) (.*)/,
	      names: ['semantics', 'ssrcs'],
	      format: 'ssrc-group:%s %s'
	    },
	    {
	      // a=msid-semantic: WMS Jvlam5X3SX1OP6pn20zWogvaKJz5Hjf9OnlV
	      name: 'msidSemantic',
	      reg: /^msid-semantic:\s?(\w*) (\S*)/,
	      names: ['semantic', 'token'],
	      format: 'msid-semantic: %s %s' // space after ':' is not accidental
	    },
	    {
	      // a=group:BUNDLE audio video
	      push: 'groups',
	      reg: /^group:(\w*) (.*)/,
	      names: ['type', 'mids'],
	      format: 'group:%s %s'
	    },
	    {
	      // a=rtcp-mux
	      name: 'rtcpMux',
	      reg: /^(rtcp-mux)/,
	      format: '%s'
	    },
	    {
	      // a=rtcp-rsize
	      name: 'rtcpRsize',
	      reg: /^(rtcp-rsize)/,
	      format: '%s'
	    },
	    {
	      // a=sctpmap:5000 webrtc-datachannel 1024
	      name: 'sctpmap',
	      reg: /^sctpmap:([\w_/]*) (\S*)(?: (\S*))?/,
	      names: ['sctpmapNumber', 'app', 'maxMessageSize'],
	      format: function (o) {
	        return (o.maxMessageSize != null)
	          ? 'sctpmap:%s %s %s'
	          : 'sctpmap:%s %s';
	      }
	    },
	    {
	      // a=x-google-flag:conference
	      name: 'xGoogleFlag',
	      reg: /^x-google-flag:([^\s]*)/,
	      format: 'x-google-flag:%s'
	    },
	    {
	      // a=rid:1 send max-width=1280;max-height=720;max-fps=30;depend=0
	      push: 'rids',
	      reg: /^rid:([\d\w]+) (\w+)(?: ([\S| ]*))?/,
	      names: ['id', 'direction', 'params'],
	      format: function (o) {
	        return (o.params) ? 'rid:%s %s %s' : 'rid:%s %s';
	      }
	    },
	    {
	      // a=imageattr:97 send [x=800,y=640,sar=1.1,q=0.6] [x=480,y=320] recv [x=330,y=250]
	      // a=imageattr:* send [x=800,y=640] recv *
	      // a=imageattr:100 recv [x=320,y=240]
	      push: 'imageattrs',
	      reg: new RegExp(
	        // a=imageattr:97
	        '^imageattr:(\\d+|\\*)' +
	        // send [x=800,y=640,sar=1.1,q=0.6] [x=480,y=320]
	        '[\\s\\t]+(send|recv)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*)' +
	        // recv [x=330,y=250]
	        '(?:[\\s\\t]+(recv|send)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*))?'
	      ),
	      names: ['pt', 'dir1', 'attrs1', 'dir2', 'attrs2'],
	      format: function (o) {
	        return 'imageattr:%s %s %s' + (o.dir2 ? ' %s %s' : '');
	      }
	    },
	    {
	      // a=simulcast:send 1,2,3;~4,~5 recv 6;~7,~8
	      // a=simulcast:recv 1;4,5 send 6;7
	      name: 'simulcast',
	      reg: new RegExp(
	        // a=simulcast:
	        '^simulcast:' +
	        // send 1,2,3;~4,~5
	        '(send|recv) ([a-zA-Z0-9\\-_~;,]+)' +
	        // space + recv 6;~7,~8
	        '(?:\\s?(send|recv) ([a-zA-Z0-9\\-_~;,]+))?' +
	        // end
	        '$'
	      ),
	      names: ['dir1', 'list1', 'dir2', 'list2'],
	      format: function (o) {
	        return 'simulcast:%s %s' + (o.dir2 ? ' %s %s' : '');
	      }
	    },
	    {
	      // old simulcast draft 03 (implemented by Firefox)
	      //   https://tools.ietf.org/html/draft-ietf-mmusic-sdp-simulcast-03
	      // a=simulcast: recv pt=97;98 send pt=97
	      // a=simulcast: send rid=5;6;7 paused=6,7
	      name: 'simulcast_03',
	      reg: /^simulcast:[\s\t]+([\S+\s\t]+)$/,
	      names: ['value'],
	      format: 'simulcast: %s'
	    },
	    {
	      // a=framerate:25
	      // a=framerate:29.97
	      name: 'framerate',
	      reg: /^framerate:(\d+(?:$|\.\d+))/,
	      format: 'framerate:%s'
	    },
	    {
	      // RFC4570
	      // a=source-filter: incl IN IP4 239.5.2.31 10.1.15.5
	      name: 'sourceFilter',
	      reg: /^source-filter: *(excl|incl) (\S*) (IP4|IP6|\*) (\S*) (.*)/,
	      names: ['filterMode', 'netType', 'addressTypes', 'destAddress', 'srcList'],
	      format: 'source-filter: %s %s %s %s %s'
	    },
	    {
	      // a=bundle-only
	      name: 'bundleOnly',
	      reg: /^(bundle-only)/,
	      format: '%s'
	    },
	    {
	      // a=label:1
	      name: 'label',
	      reg: /^label:(.+)/,
	      format: 'label:%s'
	    },
	    {
	      // RFC version 26 for SCTP over DTLS
	      // https://tools.ietf.org/html/draft-ietf-mmusic-sctp-sdp-26#section-5
	      name: 'sctpPort',
	      reg: /^sctp-port:(\d+)$/,
	      format: 'sctp-port:%s'
	    },
	    {
	      // RFC version 26 for SCTP over DTLS
	      // https://tools.ietf.org/html/draft-ietf-mmusic-sctp-sdp-26#section-6
	      name: 'maxMessageSize',
	      reg: /^max-message-size:(\d+)$/,
	      format: 'max-message-size:%s'
	    },
	    {
	      // RFC7273
	      // a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0:37
	      push:'tsRefClocks',
	      reg: /^ts-refclk:([^\s=]*)(?:=(\S*))?/,
	      names: ['clksrc', 'clksrcExt'],
	      format: function (o) {
	        return 'ts-refclk:%s' + (o.clksrcExt != null ? '=%s' : '');
	      }
	    },
	    {
	      // RFC7273
	      // a=mediaclk:direct=963214424
	      name:'mediaClk',
	      reg: /^mediaclk:(?:id=(\S*))? *([^\s=]*)(?:=(\S*))?(?: *rate=(\d+)\/(\d+))?/,
	      names: ['id', 'mediaClockName', 'mediaClockValue', 'rateNumerator', 'rateDenominator'],
	      format: function (o) {
	        var str = 'mediaclk:';
	        str += (o.id != null ? 'id=%s %s' : '%v%s');
	        str += (o.mediaClockValue != null ? '=%s' : '');
	        str += (o.rateNumerator != null ? ' rate=%s' : '');
	        str += (o.rateDenominator != null ? '/%s' : '');
	        return str;
	      }
	    },
	    {
	      // a=keywds:keywords
	      name: 'keywords',
	      reg: /^keywds:(.+)$/,
	      format: 'keywds:%s'
	    },
	    {
	      // a=content:main
	      name: 'content',
	      reg: /^content:(.+)/,
	      format: 'content:%s'
	    },
	    // BFCP https://tools.ietf.org/html/rfc4583
	    {
	      // a=floorctrl:c-s
	      name: 'bfcpFloorCtrl',
	      reg: /^floorctrl:(c-only|s-only|c-s)/,
	      format: 'floorctrl:%s'
	    },
	    {
	      // a=confid:1
	      name: 'bfcpConfId',
	      reg: /^confid:(\d+)/,
	      format: 'confid:%s'
	    },
	    {
	      // a=userid:1
	      name: 'bfcpUserId',
	      reg: /^userid:(\d+)/,
	      format: 'userid:%s'
	    },
	    {
	      // a=floorid:1
	      name: 'bfcpFloorId',
	      reg: /^floorid:(.+) (?:m-stream|mstrm):(.+)/,
	      names: ['id', 'mStream'],
	      format: 'floorid:%s mstrm:%s'
	    },
	    {
	      // any a= that we don't understand is kept verbatim on media.invalid
	      push: 'invalid',
	      names: ['value'],
	      reg: /(.*)/,
	      format: '%s'
	    }
	  ]
	};

	// customized util.format - discards excess arguments and can void middle ones
	const formatRegExp = /%[sdv%]/g;

	function format(formatStr) {
	  let i = 1;

	  const args = arguments,
	  len = args.length;
	  
	  return formatStr.replace(formatRegExp, (x) => {
	    if (i >= len) {
	      return x; // missing argument
	    }
	    var arg = args[i];
	    i += 1;
	    switch (x) {
	    case '%%':
	      return '%';
	    case '%s':
	      return String(arg);
	    case '%d':
	      return Number(arg);
	    case '%v':
	      return '';
	    }
	  });
	  // NB: we discard excess arguments - they are typically undefined from makeLine
	}
	function makeLine(type, obj, location) {
	  const str = obj.format instanceof Function ?
	    (obj.format(obj.push ? location : location[obj.name])) :
	    obj.format,
	    args = [type + '=' + str];

	  if (obj.names) {
	    for (let i = 0; i < obj.names.length; i += 1) {
	      const n = obj.names[i];
	      if (obj.name) {
	        args.push(location[obj.name][n]);
	      } else { // for mLine and push attributes
	        args.push(location[obj.names[i]]);
	      }
	    }
	  } else {
	    args.push(location[obj.name]);
	  }
	  return format.apply(null, args);
	}
	// RFC specified order
	// TODO: extend this with all the rest
	const defaultOuterOrder = [
	  'v', 'o', 's', 'i',
	  'u', 'e', 'p', 'c',
	  'b', 't', 'r', 'z', 'a'
	],
	defaultInnerOrder = ['i', 'c', 'b', 'a'];


	class Writer {

		static write(session, opts = {}) {
			//opts = opts || {};
		  // ensure certain properties exist
		  if (session.version == null) {
		    session.version = 0; // 'v=0' must be there (only defined version atm)
		  }
		  if (session.name == null) {
		    session.name = ' '; // 's= ' must be there if no meaningful name set
		  }
		  session.media.forEach(function (mLine) {
		    if (mLine.payloads == null) {
		      mLine.payloads = '';
		    }
		  });

		  const outerOrder = opts.outerOrder || defaultOuterOrder,
		  innerOrder = opts.innerOrder || defaultInnerOrder,
		  sdp = [];

		  // loop through outerOrder for matching properties on session
		  outerOrder.forEach((type) => {

		    grammar[type].forEach((obj) => {

		      if (obj.name in session && session[obj.name] != null) {
		        sdp.push(makeLine(type, obj, session));
		      }
		      else if (obj.push in session && session[obj.push] != null) {
		        session[obj.push].forEach((el) => {
		          sdp.push(makeLine(type, obj, el));
		        });
		      }
		    });

		  });

		  // then for each media line, follow the innerOrder
		  session.media.forEach((mLine) => {
		    sdp.push(makeLine('m', grammar.m[0], mLine));

		    innerOrder.forEach((type) => {
		      grammar[type].forEach((obj) => {
		        if (obj.name in mLine && mLine[obj.name] != null) {
		          sdp.push(makeLine(type, obj, mLine));
		        }
		        else if (obj.push in mLine && mLine[obj.push] != null) {
		          mLine[obj.push].forEach((el) => {
		            sdp.push(makeLine(type, obj, el));
		          });
		        }
		      });
		    });
		  });

		  return sdp.join('\r\n') + '\r\n';
		}
	}

	function toIntIfInt(v) {
	  return String(Number(v)) === v ? Number(v) : v;
	}

	function attachProperties(match, location, names, rawName) {
	  if (rawName && !names) {
	    location[rawName] = toIntIfInt(match[1]);
	  } else {
	    for (let i = 0; i < names.length; i += 1) {
	      if (match[i+1] != null) {
	        location[names[i]] = toIntIfInt(match[i+1]);
	      }
	    }
	  }
	}

	function parseReg(obj, location, content) {
	  const needsBlank = obj.name && obj.names;

	  if (obj.push && !location[obj.push]) {
	    location[obj.push] = [];
	  } else if (needsBlank && !location[obj.name]) {
	    location[obj.name] = {};
	  }

	  const keyLocation = obj.push ?
	    {} :  // blank object that will be pushed
	    needsBlank ? location[obj.name] : location; // otherwise, named location or root

	  attachProperties(content.match(obj.reg), keyLocation, obj.names, obj.name);

	  if (obj.push) {
	    location[obj.push].push(keyLocation);
	  }
	}


	const validLine = RegExp.prototype.test.bind(/^([a-z])=(.*)/);

	function paramReducer(acc, expr) {
	  const s = expr.split(/=(.+)/, 2);

	  if (s.length === 2) {
	    acc[s[0]] = toIntIfInt(s[1]);
	  } else if (s.length === 1 && expr.length > 1) {
	    acc[s[0]] = undefined;
	  }

	  return acc;
	}


	class Parser {

	  static parse(sdp) {
	    const session = {}
	      , media = []; // points at where properties go under (one of the above)

	    let location = session;

	    // parse lines we understand
	    sdp.split(/(\r\n|\r|\n)/).filter(validLine).forEach((l) => {
	      const type = l[0],
	      content = l.slice(2);

	      if (type === 'm') {
	        media.push({rtp: [], fmtp: []});
	        location = media[media.length-1]; // point at latest media line
	      }

	      for (let j = 0; j < (grammar[type] || []).length; j += 1) {
	        const obj = grammar[type][j];

	        if (obj.reg.test(content)) {
	          return parseReg(obj, location, content);
	        }
	      }
	    });

	    session.media = media; // link it up
	    return session;
	  }

	  static parseParams(str) {
	    return str.split(/;\s?/).reduce(paramReducer, {});
	  }

	  /*
	   * Reverse the config object back to a string
	   */
	  static writeConfigParams(config) {
	    return Object.keys(config).map(key => key + '=' + config[key]).join(';');
	  }

	  static parsePayloads(str) {
	    return str.toString().split(' ').map(Number);
	  }

	  static parseRemoteCandidates(str) {
	    const candidates = [],
	    parts = str.split(' ').map(toIntIfInt);

	    for (let i = 0; i < parts.length; i += 3) {
	      candidates.push({
	        component: parts[i],
	        ip: parts[i + 1],
	        port: parts[i + 2]
	      });
	    }

	    return candidates;
	  }

	  static parseImageAttributes(str) {
	    return str.split(' ').map((item) => {
	      return item.substring(1, item.length-1).split(',').reduce(paramReducer, {});
	    });
	  }

	  static parseSimulcastStreamList(str) {
	    return str.split(';').map((stream) => {
	      return stream.split(',').map((format) => {
	        let scid, paused = false;

	        if (format[0] !== '~') {
	          scid = toIntIfInt(format);
	        } else {
	          scid = toIntIfInt(format.substring(1, format.length));
	          paused = true;
	        }

	        return {
	          scid: scid,
	          paused: paused
	        };
	      });
	    });
	  }

	}

	class PeerUtils {
		static get supportCodecPreferences() {
			return ('RTCRtpTransceiver' in window && 'setCodecPreferences' in window.RTCRtpTransceiver.prototype);
		}

		static get supportParameters() {
			return ('setParameters' in window.RTCRtpSender.prototype);
		}

		static generateId(size = 10) {
			const bytes = new Uint32Array(size);
			window.crypto.getRandomValues(bytes);
			return bytes.toString('hex').slice(0, size);
		} 

		static get RTCPeerConnection() {
			return window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
		}

		static get RTCSessionDescription() {
			return window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
		}

	    static get RTCIceCandidate() {
	    	return window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
	    }
	}

	/**
	 * SDP Codec and bitrate utils
	 */
	class SDPUtils {

	  static get isFirefox() {
	    return navigator.userAgent.indexOf("Firefox") > -1;
	  }

	  static get mimeTypeMap() {
	    return {
	        "opus": "audio/opus",
	        "H264": "video/H264",
	        "VP8": "video/VP8",
	        "VP9": "video/VP9"
	    }
	  }

	  static configureOpus(config, opusConfig) {
	      const conf = this.merge(config, opusConfig);
	      delete conf.maxptime;
	      delete conf.ptime;
	      return conf;
	  }

	  static merge(from, to) {
	      return Object.assign({}, from, to);
	  }

	  static formatConfig(config) {
	      return this.writeConfigParams(config);
	  }

	  /**
	   * Format google bitrate configs
	   */
	  static formatGoogleBandwidth(min, max) {
	      return {
	          'x-google-min-bitrate': min,
	          'x-google-max-bitrate': max
	      }
	  }

	  /**
	   * Format google bitrate configs with start bitrate
	   */
	  static formatGoogleVideoBandwidth(min, max, start) {
	      const config = this.formatGoogleBandwidth(min, max);
	      if (start) config['x-google-start-bitrate'] = start;
	      return config;
	  }
	  /**
	   * Sets a bandwidth limit config
	   * Firefox requires TIAS
	   */
	  static formatBandwidth(max) {
	      let limit = max;


	      //TIAS is chosen for chrome and causes sdp errors. Use AS for Chrome.
	      if (this.isFirefox) {
	        limit = max * 1000;

	        return [
	         // { type: "AS", limit: limit },
	         // { type: "CT", limit: limit },
	          { type: "TIAS", limit: limit },

	        ];
	      }

	      return [
	        { type: "AS", limit: limit },
	        { type: "CT", limit: limit },

	      ];

	  }


	  /**
	   * Formats fmtp configs for adding x-google-max-bitrate
	   */
	  static formatFmtpConfig(media, config) {
	      media.fmtp.map(fmtp => {
	          //merge fmtp config if set
	          //convert back to a string config after
	          fmtp.config = this.formatConfig(fmtp.config ? this.merge(Parser.parseParams(fmtp.config), config) : config);
	      });
	  }

	  /**
	   * Opus codec configs
	   */
	  static  setOpusConfig(media, opusConfig) {
	        let opusConf = {};

	        if (media.type == "audio") {
	          if (media.rtp[0].codec == "opus" && opusConfig) {
	            let originalOpusConfig = {};
	            //has an opus config already
	            if (media.fmtp[0] && media.fmtp[0].config) 
	              originalOpusConfig = Parser.parseParams(media.fmtp[0].config);
	            else
	              media.fmtp.push({});
	            
	            opusConf = this.configureOpus(originalOpusConfig, opusConfig);
	            media.fmtp[0].config = this.formatConfig(opusConf);
	            //packet length
	            if (opusConfig.maxptime) media.maxptime = opusConfig.maxptime;
	            if (opusConfig.ptime) media.ptime = opusConfig.ptime;
	          }
	        }

	        return opusConf;
	  }

	  /**
	   * Set max bitrate
	   */
	  static setMaxBitrate(media, bwConfig) {
	      let config;
	      switch (media.type) {
	          case "audio":
	             
	              //bitrate config
	              if (bwConfig.audioBitrate) {
	                  let bitrateConfig = this.formatGoogleBandwidth(bwConfig.audioBitrate, bwConfig.audioBitrate);
	                  media.bandwidth = this.formatBandwidth(bwConfig.audioBitrate);
	                  this.formatFmtpConfig(media, bitrateConfig);
	              }
	           
	              break;
	          case "video":
	              if (bwConfig.maxVideoBitrate) {
	                  config = this.formatGoogleVideoBandwidth(bwConfig.minVideoBitrate, bwConfig.maxVideoBitrate, bwConfig.startVideoBitrate);
	                  this.formatFmtpConfig(media, config);
	                  media.bandwidth = this.formatBandwidth(bwConfig.maxVideoBitrate);
	              }
	              if (bwConfig.videoFrameRate) media.framerate = bwConfig.videoFrameRate;
	              break;
	      }
	  }

	  /**
	   * Parse SDP and filter codecs on codec and level if set.
	   */
	  static filterCodecs(media, preferredCodecs) {
	      const prefferredCodec = preferredCodecs[media.type];
	      //filter rtp by codec
	      let rtp1 = media.rtp.filter(rtp => rtp.codec == prefferredCodec.codec),
	          //filter fmtp configs by rtp payload
	          //filter fmtp by h264 level if set
	          fmtp1 = media.fmtp.filter(fmtp => rtp1.find(rtp => rtp.payload === fmtp.payload)).filter(fmtp => prefferredCodec.level && fmtp.config ? fmtp.config.indexOf(prefferredCodec.level) > -1 : true);
	      //reduce rtp again from fmtp payloads
	      if (prefferredCodec.level) {
	          rtp1 = rtp1.filter(rtp => fmtp1.find(fmtp => rtp.payload === fmtp.payload));
	      }
	      media.rtp = rtp1;
	      media.fmtp = fmtp1;
	      //reduce payloads from rtp
	      let payloads = media.rtp.map(rtp => rtp.payload);
	      //reduce rtcp by payloads
	      if (media.rtcpFb) media.rtcpFb = media.rtcpFb.filter(rtcpFb => payloads.indexOf(rtcpFb.payload) > -1);
	      media.payloads = payloads.join(" ");

	     // this.chosenPrefferredCodecs = rtp1;

	    //  this._debug('preferred codecs %o', rtp1)
	      //console.log("CODECS ", media);
	  }

	  /**
	   * Transform SDP for codec selection and bitrate selection
	   */

	  static filterCodecAndBitrate(description, preferredCodecs, config, codecFilterFallback = false) {
	       const filterCodecs = preferredCodecs;
	      if (filterCodecs || config.maxVideoBitrate) {
	          const sdp = Parser.parse(description.sdp);
	          sdp.media.map(media => {  
	            switch (media.type) {
	              case "video":
	              case "audio":
	              //for browsers that don't support setCodecPreferences, SDP transformation is required
	              if (filterCodecs) this.filterCodecs(media, preferredCodecs);
	              if (config.opusConfig && media.type == "audio") this.setOpusConfig(media, config.opusConfig);
	              if (config.maxVideoBitrate) this.setMaxBitrate(media, config);
	              break;
	            }
	              return media;
	          });
	          //console.log(sdp.media);
	          description.sdp = Writer.write(sdp);
	          //console.log("OUTPUT", description.sdp);
	      }
	      return description;
	  }

	  /**
	   * Transform SDP for bitrate selection only
	   */
	  static filterBitrate(description, config) {
	    return this.filterCodecAndBitrate(description, null, config);
	  }

	  /**
	   * From the supported codecs filter by mimetype map then by H264 level if set.
	   */
	  static preferCodec(codecs, codec) {
	      return codecs
	      .filter(supportedCodec => supportedCodec.mimeType == this.mimeTypeMap[codec.codec])
	      .filter(chosenCodec => {
	      if (codec.level) {
	        //IOS completely fails to report an sdpFmtpLine properly, making level filtering fail. Make it fallback to SDP mangling. 
	        if (!chosenCodec.sdpFmtpLine) return false;

	        const ret = chosenCodec.sdpFmtpLine.indexOf(codec.level) > -1;
	        //if a h264 mode filter is set
	        if (codec.mode >= 0) {
	          return ret && chosenCodec.sdpFmtpLine.indexOf("packetization-mode=" + codec.mode.toString()) > -1;
	        }

	        return ret;
	      }

	      return true;
	    });
	      //.filter(chosenCodec => codec.level && chosenCodec.sdpFmtpLine ? chosenCodec.sdpFmtpLine.indexOf(codec.level) > -1 : true);
	  }

	  static writeConfigParams(config) {
	      return Object.keys(config).map(key => key + '=' + config[key]).join(';');
	  }
	}


	//module.exports = SDPUtils;

	//import debug from 'debug';


	const MAX_BUFFERED_AMOUNT = 64 * 1024,
	ICECOMPLETE_TIMEOUT = 5 * 1000,
	CHANNEL_CLOSING_TIMEOUT = 5 * 1000;



	// HACK: Filter trickle lines when trickle is disabled #354
	function filterTrickle(sdp) {
	    return sdp.replace(/a=ice-options:trickle\s\n/g, '')
	}

	function makeError(message, code) {
	    var err = new Error(message);
	    err.code = code;
	    return err
	}

	function warn(message) {
	    console.warn(message);
	}

	/**
	 * WebRTC peer connection. Same API as node core `net.Socket`, plus a few extra methods.
	 * Duplex stream.
	 * @param {Object} opts
	 */
	//class Peer extends stream.Duplex {
	class Peer extends EventEmitter  {
	    constructor(opts) {
	        super();
	        /*opts = Object.assign({
	            allowHalfOpen: false
	        }, opts)
	        super(opts)*/
	        this._id = PeerUtils.generateId();
	        this._debug('new peer %o', opts);
	        this.channelName = opts.initiator ? opts.channelName || PeerUtils.generateId(20) : null;
	        this.initiator = opts.initiator || false;
	        this.channelConfig = opts.channelConfig || Peer.channelConfig;
	        //this.dataChannel = opts.dataChannel;
	        this.dataSubscriber = opts.dataSubscriber;
	        this.negotiated = this.channelConfig.negotiated;
	        this.config = SDPUtils.merge(Peer.defaultConfig, opts.config);
	        this.offerOptions = opts.offerOptions || {};
	        this.answerOptions = opts.answerOptions || {};
	        this.sdpTransform = opts.sdpTransform || (sdp => sdp);
	        this.streams = opts.streams || (opts.stream ? [opts.stream] : []); // support old "stream" option
	        this.trickle = opts.trickle !== undefined ? opts.trickle : true;
	        this.allowHalfTrickle = opts.allowHalfTrickle !== undefined ? opts.allowHalfTrickle : false;
	        this.iceCompleteTimeout = opts.iceCompleteTimeout || ICECOMPLETE_TIMEOUT;
	        //bitrate and framerate configs
	        this.minVideoBitrate = opts.minVideoBitrate;
	        this.maxVideoBitrate = opts.maxVideoBitrate;
	        this.startVideoBitrate = opts.startVideoBitrate || 300;
	        this.audioBitrate = opts.audioBitrate;
	        this.videoFrameRate = opts.videoFrameRate;
	        this.opusConfig = opts.opus;
	        this.preferredCodecs = opts.preferredCodecs;

	        //configure external console logger. 
	        this.debugEnabled = opts.debug || false;

	        this.destroyed = false;
	        this._connected = false;
	        this.remoteAddress = undefined;
	        this.remoteFamily = undefined;
	        this.remotePort = undefined;
	        this.localAddress = undefined;
	        this.localFamily = undefined;
	        this.localPort = undefined;
	       
	        this._pcReady = false;
	        this._channelReady = false;
	        this._iceComplete = false; // ice candidate trickle done (got null candidate)
	        this._iceCompleteTimer = null; // send an offer/answer anyway after some timeout
	        this._channel = null;
	        this._pendingCandidates = [];
	        this._isNegotiating = this.negotiated ? false : !this.initiator; // is this peer waiting for negotiation to complete?
	        this._batchedNegotiation = opts.disableNegotiate || false; // batch synchronous negotiations
	        this._queuedNegotiation = false; // is there a queued negotiation request?
	        this._sendersAwaitingStable = [];
	        this._senderMap = new Map();
	        this._firstStable = true;
	        this._closingInterval = null;
	        this._remoteTracks = [];
	        this._remoteStreams = [];
	        this._chunk = null;
	        this._cb = null;
	        this._interval = null;
	        this.simulcast = opts.simulcast || false;
	        this.sendEncodings = opts.sendEncodings || [{}];
	        try {
	            this._pc = new PeerUtils.RTCPeerConnection(this.config, opts.pcConstraints || null);
	            
	        } catch (err) {
	            queueMicrotask(() => this.destroy(makeError(err, 'ERR_PC_CONSTRUCTOR')));
	            return
	        }
	        // We prefer feature detection whenever possible, but sometimes that's not
	        // possible for certain implementations.
	        //this._isReactNativeWebrtc = typeof this._pc._peerConnectionId === 'number';
	        this._pc.oniceconnectionstatechange = () => {
	            this._onIceStateChange();
	        };
	        this._pc.onicegatheringstatechange = () => {
	            this._onIceStateChange();
	        };
	        this._pc.onconnectionstatechange = () => {
	            this._onConnectionStateChange();
	        };
	        this._pc.onsignalingstatechange = () => {
	            this._onSignalingStateChange();
	        };
	        this._pc.onicecandidate = event => {
	            this._onIceCandidate(event);
	        };
	        // Other spec events, unused by this implementation:
	        // - onconnectionstatechange
	        // - onicecandidateerror
	        // - onfingerprintfailure
	        // - onnegotiationneeded
	        //wrap data channel into a config. Wowza rtc doesn't support data channels
	        if (opts.dataChannel) {
	            //force subscribers to setup a data channel for Kurento as ondatachannel is not sent
	            if (this.initiator || this.negotiated || this.dataSubscriber) {
	                this._setupData({
	                    channel: this._pc.createDataChannel(this.channelName, this.channelConfig)
	                });
	            } else {
	                this._pc.ondatachannel = event => {
	                    this._setupData(event);
	                };
	            }
	        }
	        
	        if (this.streams) {
	            this.streams.forEach(stream => {
	                this.addStream(stream);
	            });

	            if (this.simulcast) this.setVideoEncodings(this.sendEncodings);

	            //for browsers that support setCodecPreferences, setup the preffered codecs
	            if (this.preferredCodecs) this.setCodecPreferences(this.preferredCodecs);
	        }

	        //ontrack check
	        if ('ontrack' in this._pc) {
	            this._pc.ontrack = event => {
	                this._onTrack(event);
	            };
	        } else {
	            this._pc.onaddstream = event => {
	                this._onStream(event);
	            };
	        }

	        if (opts.transceiverDirection) {
	            const init = {
	                direction: opts.transceiverDirection
	            };

	            this._pc.addTransceiver("video", init);
	            this._pc.addTransceiver("audio", init);
	        }

	        if (this.initiator) {
	            this._needsNegotiation();
	        }
	        this._onFinishBound = () => {
	            this._onFinish();
	        };
	        this.once('finish', this._onFinishBound);
	    }
	    get bufferSize() {
	        return (this._channel && this._channel.bufferedAmount) || 0;
	    }
	    // HACK: it's possible channel.readyState is "closing" before peer.destroy() fires
	    // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
	    get connected() {
	        return (this._connected && this._channel.readyState === 'open');
	    }
	    address() {
	        return {
	            port: this.localPort,
	            family: this.localFamily,
	            address: this.localAddress
	        };
	    }
	    signal(data) {
	        if (this.destroyed) throw makeError('cannot signal after peer is destroyed', 'ERR_SIGNALING');
	        if (typeof data === 'string') {
	            try {
	                data = JSON.parse(data);
	            } catch (err) {
	                data = {};
	            }
	        }
	        this._debug('signal()');
	        if (data.renegotiate && this.initiator) {
	            this._debug('got request to renegotiate');
	            this._needsNegotiation();
	        }
	        if (data.transceiverRequest && this.initiator) {
	            this._debug('got request for transceiver');
	            this.addTransceiver(data.transceiverRequest.kind, data.transceiverRequest.init);
	        }
	        if (data.candidate) {
	            if (this._pc.remoteDescription && this._pc.remoteDescription.type) {
	                this._addIceCandidate(data.candidate);
	            } else {
	                this._pendingCandidates.push(data.candidate);
	            }
	        }
	        if (data.sdp) {
	            if (this.initiator && this.maxVideoBitrate) {
	                this._onFilterBitrate(data);
	            }
	            this._pc.setRemoteDescription(new(PeerUtils.RTCSessionDescription)(data)).then(() => {
	                if (this.destroyed) return;
	                this._pendingCandidates.forEach(candidate => {
	                    this._addIceCandidate(candidate);
	                });
	                if (this._pendingCandidates) {
	                    this.addIceCandidates(this._pendingCandidates);
	                }
	                this._pendingCandidates = [];
	                if (this._pc.remoteDescription.type === 'offer') this._createAnswer();
	            }).catch(err => {
	                this.destroy(makeError(err, 'ERR_SET_REMOTE_DESCRIPTION'));
	            });
	        }
	        if (!data.sdp && !data.candidate && !data.renegotiate && !data.transceiverRequest) {
	            this.destroy(makeError('signal() called with invalid signal data', 'ERR_SIGNALING'));
	        }
	    }
	    addIceCandidates(candidates) {
	        candidates.forEach(candidate => {
	            this._addIceCandidate(candidate);
	        });
	    }
	    _addIceCandidate(candidate) {
	        var iceCandidateObj = new PeerUtils.RTCIceCandidate(candidate);
	        this._pc.addIceCandidate(iceCandidateObj).catch(err => {
	            if (!iceCandidateObj.address || iceCandidateObj.address.endsWith('.local')) {
	                warn('Ignoring unsupported ICE candidate.');
	            } else {
	                this.destroy(makeError(err, 'ERR_ADD_ICE_CANDIDATE'));
	            }
	        });
	    }
	    /**
	     * Send text/binary data to the remote peer.
	     * @param {ArrayBufferView|ArrayBuffer|Buffer|string|Blob} chunk
	     */
	    send(chunk) {
	        this._channel.send(chunk);
	    }
	    /**
	     * Add a Transceiver to the connection.
	     * @param {String} kind
	     * @param {Object} init
	     */
	    addTransceiver(kind, init) {
	        this._debug('addTransceiver()');
	        if (this.initiator) {
	            try {
	                this._pc.addTransceiver(kind, init);
	                this._needsNegotiation();
	            } catch (err) {
	                this.destroy(makeError(err, 'ERR_ADD_TRANSCEIVER'));
	            }
	        } else {
	            this.emit('signal', { // request initiator to renegotiate
	                transceiverRequest: {
	                    kind,
	                    init
	                }
	            });
	        }
	    }
	    /**
	     * Add a MediaStream to the connection.
	     * @param {MediaStream} stream
	     */
	    addStream(stream) {
	        this._debug('addStream()');

	        if (this.simulcast && this.sendEncodings) {
	            const transceiverInit = {
	                "video": {
	                    sendEncodings: this.sendEncodings
	                },
	                "audio": {}
	            };
	            stream.getTracks().forEach(track => {
	                const init = Object.assign({}, transceiverInit[track.kind], { streams: [stream] });
	                this.addTransceiver(track, init);
	            });

	                    
	        } else {
	            if ('addTrack' in this._pc) {
	                stream.getTracks().forEach(track => {
	                    this.addTrack(track, stream);
	                });
	            } else {
	                this._pc.addStream(stream);
	            }
	        }


	        
	    }

	    /**
	     * Add a MediaStreamTrack to the connection.
	     * @param {MediaStreamTrack} track
	     * @param {MediaStream} stream
	     */
	    addTrack(track, stream) {
	        this._debug('addTrack()');
	        var submap = this._senderMap.get(track) || new Map(); // nested Maps map [track, stream] to sender
	        var sender = submap.get(stream);
	        if (!sender) {
	            sender = this._pc.addTrack(track, stream);
	            submap.set(stream, sender);
	            this._senderMap.set(track, submap);
	            this._needsNegotiation();
	        } else if (sender.removed) {
	            throw makeError('Track has been removed. You should enable/disable tracks that you want to re-add.', 'ERR_SENDER_REMOVED');
	        } else {
	            throw makeError('Track has already been added to that stream.', 'ERR_SENDER_ALREADY_ADDED');
	        }
	    }
	    /**
	     * Replace a MediaStreamTrack by another in the connection.
	     * @param {MediaStreamTrack} oldTrack
	     * @param {MediaStreamTrack} newTrack
	     * @param {MediaStream} stream
	     */
	    replaceTrack(oldTrack, newTrack, stream) {
	        this._debug('replaceTrack()');
	        var submap = this._senderMap.get(oldTrack);
	        var sender = submap ? submap.get(stream) : null;
	        if (!sender) {
	            throw makeError('Cannot replace track that was never added.', 'ERR_TRACK_NOT_ADDED');
	        }
	        if (newTrack) this._senderMap.set(newTrack, submap);
	        if (sender.replaceTrack != null) {
	            sender.replaceTrack(newTrack);
	        } else {
	            this.destroy(makeError('replaceTrack is not supported in this browser', 'ERR_UNSUPPORTED_REPLACETRACK'));
	        }
	    }

	    /**
	     * Remove a MediaStreamTrack from the connection.
	     * @param {MediaStreamTrack} track
	     * @param {MediaStream} stream
	     */
	    removeTrack(track, stream) {
	        this._debug('removeSender()');
	        var submap = this._senderMap.get(track);
	        var sender = submap ? submap.get(stream) : null;
	        if (!sender) {
	            throw makeError('Cannot remove track that was never added.', 'ERR_TRACK_NOT_ADDED');
	        }
	        try {
	            sender.removed = true;
	            this._pc.removeTrack(sender);
	        } catch (err) {
	            if (err.name === 'NS_ERROR_UNEXPECTED') {
	                this._sendersAwaitingStable.push(sender); // HACK: Firefox must wait until (signalingState === stable) https://bugzilla.mozilla.org/show_bug.cgi?id=1133874
	            } else {
	                this.destroy(makeError(err, 'ERR_REMOVE_TRACK'));
	            }
	        }
	        this._needsNegotiation();
	    }
	    /**
	     * Remove a MediaStream from the connection.
	     * @param {MediaStream} stream
	     */
	    removeStream(stream) {
	        this._debug('removeSenders()');
	        stream.getTracks().forEach(track => {
	            this.removeTrack(track, stream);
	        });
	    }
	    _needsNegotiation() {
	        this._debug('_needsNegotiation');
	        if (this._batchedNegotiation) return; // batch synchronous renegotiations
	        this._batchedNegotiation = true;
	        queueMicrotask(() => {
	            this._batchedNegotiation = false;
	            this._debug('starting batched negotiation');
	            this.negotiate();
	        });
	    }
	    negotiate() {
	        if (this.initiator) {
	            if (this._isNegotiating) {
	                this._queuedNegotiation = true;
	                this._debug('already negotiating, queueing');
	            } else {
	                this._debug('start negotiation');
	                setTimeout(() => { // HACK: Chrome crashes if we immediately call createOffer
	                    this._createOffer();
	                }, 0);
	            }
	        } else {
	            if (!this._isNegotiating) {
	                this._debug('requesting negotiation from initiator');
	                this.emit('signal', { // request initiator to renegotiate
	                    renegotiate: true
	                });
	            }
	        }
	        this._isNegotiating = true;
	    }
	    destroy(err, cb) {
	        if (this.destroyed) return;

	            //console.log(err);
	        this._debug('destroy (error: %s)', err && (err.message || err));
	        this.destroyed = true;
	        this._connected = false;
	        this._pcReady = false;
	        this._channelReady = false;
	        this._remoteTracks = null;
	        this._remoteStreams = null;
	        this._senderMap = null;
	        clearInterval(this._closingInterval);
	        this._closingInterval = null;
	        clearInterval(this._interval);
	        this._interval = null;
	        this._chunk = null;
	        this._cb = null;
	        this.off('finish', this._onFinishBound);
	        this._onFinishBound = null;
	        if (this._channel) {
	            try {
	                this._channel.close();
	            } catch (err) {}
	            this._channel.onmessage = null;
	            this._channel.onopen = null;
	            this._channel.onclose = null;
	            this._channel.onerror = null;
	        }
	        if (this._pc) {
	            try {
	                this._pc.close();
	            } catch (err) {}
	            this._pc.oniceconnectionstatechange = null;
	            this._pc.onicegatheringstatechange = null;
	            this._pc.onsignalingstatechange = null;
	            this._pc.onicecandidate = null;
	            this._pc.ontrack = null;
	            this._pc.ondatachannel = null;
	        }
	        this._pc = null;
	        this._channel = null;
	        if (err) this.emit('error', err);
	        this.emit('close');
	        //cb()
	    }
	    _setupData(event) {
	        if (!event.channel) {
	            // In some situations `pc.createDataChannel()` returns `undefined` (in wrtc),
	            // which is invalid behavior. Handle it gracefully.
	            // See: https://github.com/feross/simple-peer/issues/163
	            return this.destroy(makeError('Data channel event is missing `channel` property', 'ERR_DATA_CHANNEL'));
	        }
	        this._channel = event.channel;
	        this._channel.binaryType = 'arraybuffer';
	        if (typeof this._channel.bufferedAmountLowThreshold === 'number') {
	            this._channel.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT;
	        }
	        this.channelName = this._channel.label;
	        this._channel.onmessage = event => {
	            this._onChannelMessage(event);
	        };
	        this._channel.onbufferedamountlow = () => {
	            this._onChannelBufferedAmountLow();
	        };
	        this._channel.onopen = () => {
	            this._onChannelOpen();
	        };
	        this._channel.onclose = () => {
	            //this._onChannelClose();
	        };
	        this._channel.onerror = err => {
	            this.destroy(makeError(err, 'ERR_DATA_CHANNEL'));
	        };
	        // HACK: Chrome will sometimes get stuck in readyState "closing", let's check for this condition
	        // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
	        var isClosing = false;
	        this._closingInterval = setInterval(() => { // No "onclosing" event
	            if (this._channel && this._channel.readyState === 'closing') {
	                if (isClosing) this._onChannelClose(); // closing timed out: equivalent to onclose firing
	                isClosing = true;
	            } else {
	                isClosing = false;
	            }
	        }, CHANNEL_CLOSING_TIMEOUT);
	    }
	    /*_read() {}
	    _write(chunk, encoding, cb) {
	        if (this.destroyed) return cb(makeError('cannot write after peer is destroyed', 'ERR_DATA_CHANNEL'));
	        if (this._connected) {
	            try {
	                this.send(chunk);
	            } catch (err) {
	                return this.destroy(makeError(err, 'ERR_DATA_CHANNEL'));
	            }
	            if (this._channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
	                this._debug('start backpressure: bufferedAmount %d', this._channel.bufferedAmount);
	                this._cb = cb;
	            } else {
	                cb(null);
	            }
	        } else {
	            this._debug('write before connect');
	            this._chunk = chunk;
	            this._cb = cb;
	        }
	    }*/
	    // When stream finishes writing, close socket. Half open connections are not
	    // supported.
	    _onFinish() {
	        if (this.destroyed) return;
	        // Wait a bit before destroying so the socket flushes.
	        // TODO: is there a more reliable way to accomplish this?
	        const destroySoon = () => {
	            setTimeout(() => this.destroy(), 1000);
	        };
	        if (this._connected) {
	            destroySoon();
	        } else {
	            this.once('connect', destroySoon);
	        }
	    }
	    _startIceCompleteTimeout() {
	        if (this.destroyed) return;
	        if (this._iceCompleteTimer) return;
	        this._debug('started iceComplete timeout');
	        this._iceCompleteTimer = setTimeout(() => {
	            if (!this._iceComplete) {
	                this._iceComplete = true;
	                this._debug('iceComplete timeout completed');
	                this.emit('iceTimeout');
	                this.emit('_iceComplete');
	            }
	        }, this.iceCompleteTimeout);
	    }
	    _onOffer(offer) {
	        if (this.destroyed) return;
	        if (!this.trickle && !this.allowHalfTrickle) offer.sdp = filterTrickle(offer.sdp);
	        offer.sdp = this.sdpTransform(offer.sdp);
	        const sendOffer = () => {
	            if (this.destroyed) return;
	            var signal = this._pc.localDescription || offer;
	            this._debug('signal');
	            this.emit('signal', {
	                type: signal.type,
	                sdp: signal.sdp
	            });
	        };
	        const onSuccess = () => {
	            this._debug('createOffer success');
	            if (this.destroyed) return;
	            if (this.trickle || this._iceComplete) sendOffer();
	            else this.once('_iceComplete', sendOffer); // wait for candidates
	        };
	        const onError = err => {
	            this.destroy(makeError(err, 'ERR_SET_LOCAL_DESCRIPTION'));
	        };
	        this._pc.setLocalDescription(offer).then(onSuccess).catch(onError);
	    }

	    get bwConfig() {
	      return {
	        audioBitrate: this.audioBitrate, 
	        minVideoBitrate: this.minVideoBitrate, 
	        maxVideoBitrate: this.maxVideoBitrate, 
	        startVideoBitrate: this.startVideoBitrate, 
	        videoFrameRate: this.videoFrameRate, 
	        opusConfig: this.opusConfig
	      };
	    }

	    /**
	     * Transform SDP for codec and bitrate selection
	     */
	    _onFilterCodecAndBitrate(description) {
	        return SDPUtils.filterCodecAndBitrate(description, this.preferredCodecs, this.bwConfig, this.codecFilterFallback);
	    }

	    /**
	     * Transform SDP for bitrate selection on the answer
	     */
	    _onFilterBitrate(description) {
	        return SDPUtils.filterBitrate(description, this.bwConfig);
	    }
	    _createOffer() {
	        if (this.destroyed) return
	        this._pc.createOffer(this.offerOptions).then(offer => this._onFilterCodecAndBitrate(offer)).then(offer => this._onOffer(offer)).catch(err => {
	            this.destroy(makeError(err, 'ERR_CREATE_OFFER'));
	        });
	    }
	    _requestMissingTransceivers() {
	        if (this._pc.getTransceivers) {
	            this._pc.getTransceivers().forEach(transceiver => {
	                if (!transceiver.mid && transceiver.sender.track && !transceiver.requested) {
	                    transceiver.requested = true; // HACK: Safari returns negotiated transceivers with a null mid
	                    this.addTransceiver(transceiver.sender.track.kind);
	                }
	            });
	        }
	    }
	    _createAnswer() {
	        if (this.destroyed) return;
	        this._pc.createAnswer(this.answerOptions).then(answer => {
	            if (this.destroyed) return;
	            if (!this.trickle && !this.allowHalfTrickle) answer.sdp = filterTrickle(answer.sdp);
	            answer.sdp = this.sdpTransform(answer.sdp);
	            const sendAnswer = () => {
	                if (this.destroyed) return;
	                var signal = this._pc.localDescription || answer;
	                this._debug('signal');
	                this.emit('signal', {
	                    type: signal.type,
	                    sdp: signal.sdp
	                });
	                if (!this.initiator) this._requestMissingTransceivers();
	            };
	            const onSuccess = () => {
	                if (this.destroyed) return;
	                if (this.trickle || this._iceComplete) sendAnswer();
	                else this.once('_iceComplete', sendAnswer);
	            };
	            const onError = err => {
	                this.destroy(makeError(err, 'ERR_SET_LOCAL_DESCRIPTION'));
	            };
	            this._pc.setLocalDescription(answer).then(onSuccess).catch(onError);
	        }).catch(err => {
	            this.destroy(makeError(err, 'ERR_CREATE_ANSWER'));
	        });
	    }
	    _onConnectionStateChange() {
	        if (this.destroyed) return;
	        if (this._pc.connectionState === 'failed') {
	            this.destroy(makeError('Connection failed.', 'ERR_CONNECTION_FAILURE'));
	        }
	    }
	    _onIceStateChange() {
	        if (this.destroyed) return;
	        var iceConnectionState = this._pc.iceConnectionState;
	        var iceGatheringState = this._pc.iceGatheringState;
	        this._debug('iceStateChange (connection: %s) (gathering: %s)', iceConnectionState, iceGatheringState);
	        this.emit('iceStateChange', iceConnectionState, iceGatheringState);
	        if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
	            this._pcReady = true;
	            this._maybeReady();
	        }
	        if (iceConnectionState === 'failed') {
	            this.destroy(makeError('Ice connection failed.', 'ERR_ICE_CONNECTION_FAILURE'));
	        }
	        if (iceConnectionState === 'closed') {
	            this.destroy(makeError('Ice connection closed.', 'ERR_ICE_CONNECTION_CLOSED'));
	        }
	    }
	    getStats(cb) {
	        // statreports can come with a value array instead of properties
	        const flattenValues = report => {
	            if (Object.prototype.toString.call(report.values) === '[object Array]') {
	                report.values.forEach(value => {
	                    Object.assign(report, value);
	                });
	            }
	            return report;
	        };
	        // Promise-based getStats() (standard)
	        if (this._pc.getStats.length === 0) {
	        //if (this._pc.getStats.length === 0 || this._isReactNativeWebrtc) {
	            this._pc.getStats().then(res => {
	                var reports = [];
	                res.forEach(report => {
	                    reports.push(flattenValues(report));
	                });
	                cb(null, reports);
	            }, err => cb(err));
	            // Single-parameter callback-based getStats() (non-standard)
	        } else if (this._pc.getStats.length > 0) {
	            this._pc.getStats(res => {
	                // If we destroy connection in `connect` callback this code might happen to run when actual connection is already closed
	                if (this.destroyed) return;
	                var reports = [];
	                res.result().forEach(result => {
	                    var report = {};
	                    result.names().forEach(name => {
	                        report[name] = result.stat(name);
	                    });
	                    report.id = result.id;
	                    report.type = result.type;
	                    report.timestamp = result.timestamp;
	                    reports.push(flattenValues(report));
	                });
	                cb(null, reports);
	            }, err => cb(err));
	            // Unknown browser, skip getStats() since it's anyone's guess which style of
	            // getStats() they implement.
	        } else {
	            cb(null, []);
	        }
	    }
	    get senders() {
	        return this._pc.getSenders();
	    }
	    getSender(type) {
	        return this.senders.filter(sender => sender.track.kind == type)[0];
	    }
	    _maybeReady() {
	        this._debug('maybeReady pc %s channel %s', this._pcReady, this._channelReady);
	        if (this._connected || this._connecting || !this._pcReady || !this._channelReady) return;
	        this._connecting = true;
	        // HACK: We can't rely on order here, for details see https://github.com/js-platform/node-webrtc/issues/339
	        const findCandidatePair = () => {
	            if (this.destroyed) return;
	            this.getStats((err, items) => {
	                if (this.destroyed) return;
	                // Treat getStats error as non-fatal. It's not essential.
	                if (err) items = [];
	                var remoteCandidates = {};
	                var localCandidates = {};
	                var candidatePairs = {};
	                var foundSelectedCandidatePair = false;
	                items.forEach(item => {
	                    // TODO: Once all browsers support the hyphenated stats report types, remove
	                    // the non-hypenated ones
	                    if (item.type === 'remotecandidate' || item.type === 'remote-candidate') {
	                        remoteCandidates[item.id] = item;
	                    }
	                    if (item.type === 'localcandidate' || item.type === 'local-candidate') {
	                        localCandidates[item.id] = item;
	                    }
	                    if (item.type === 'candidatepair' || item.type === 'candidate-pair') {
	                        candidatePairs[item.id] = item;
	                    }
	                });
	                const setSelectedCandidatePair = selectedCandidatePair => {
	                    foundSelectedCandidatePair = true;
	                    var local = localCandidates[selectedCandidatePair.localCandidateId];
	                    if (local && (local.ip || local.address)) {
	                        // Spec
	                        this.localAddress = local.ip || local.address;
	                        this.localPort = Number(local.port);
	                    } else if (local && local.ipAddress) {
	                        // Firefox
	                        this.localAddress = local.ipAddress;
	                        this.localPort = Number(local.portNumber);
	                    } else if (typeof selectedCandidatePair.googLocalAddress === 'string') {
	                        // TODO: remove this once Chrome 58 is released
	                        local = selectedCandidatePair.googLocalAddress.split(':');
	                        this.localAddress = local[0];
	                        this.localPort = Number(local[1]);
	                    }
	                    if (this.localAddress) {
	                        this.localFamily = this.localAddress.includes(':') ? 'IPv6' : 'IPv4';
	                    }
	                    var remote = remoteCandidates[selectedCandidatePair.remoteCandidateId];
	                    if (remote && (remote.ip || remote.address)) {
	                        // Spec
	                        this.remoteAddress = remote.ip || remote.address;
	                        this.remotePort = Number(remote.port);
	                    } else if (remote && remote.ipAddress) {
	                        // Firefox
	                        this.remoteAddress = remote.ipAddress;
	                        this.remotePort = Number(remote.portNumber);
	                    } else if (typeof selectedCandidatePair.googRemoteAddress === 'string') {
	                        // TODO: remove this once Chrome 58 is released
	                        remote = selectedCandidatePair.googRemoteAddress.split(':');
	                        this.remoteAddress = remote[0];
	                        this.remotePort = Number(remote[1]);
	                    }
	                    if (this.remoteAddress) {
	                        this.remoteFamily = this.remoteAddress.includes(':') ? 'IPv6' : 'IPv4';
	                    }
	                    this._debug('connect local: %s:%s remote: %s:%s', this.localAddress, this.localPort, this.remoteAddress, this.remotePort);
	                };
	                items.forEach(item => {
	                    // Spec-compliant
	                    if (item.type === 'transport' && item.selectedCandidatePairId) {
	                        setSelectedCandidatePair(candidatePairs[item.selectedCandidatePairId]);
	                    }
	                    // Old implementations
	                    if (
	                        (item.type === 'googCandidatePair' && item.googActiveConnection === 'true') || ((item.type === 'candidatepair' || item.type === 'candidate-pair') && item.selected)) {
	                        setSelectedCandidatePair(item);
	                    }
	                });
	                // Ignore candidate pair selection in browsers like Safari 11 that do not have any local or remote candidates
	                // But wait until at least 1 candidate pair is available
	                if (!foundSelectedCandidatePair && (!Object.keys(candidatePairs).length || Object.keys(localCandidates).length)) {
	                    setTimeout(findCandidatePair, 100);
	                    return
	                } else {
	                    this._connecting = false;
	                    this._connected = true;
	                }
	                if (this._chunk) {
	                    try {
	                        this.send(this._chunk);
	                    } catch (err) {
	                        return this.destroy(makeError(err, 'ERR_DATA_CHANNEL'));
	                    }
	                    this._chunk = null;
	                    this._debug('sent chunk from "write before connect"');
	                    var cb = this._cb;
	                    this._cb = null;
	                    cb(null);
	                }
	                // If `bufferedAmountLowThreshold` and 'onbufferedamountlow' are unsupported,
	                // fallback to using setInterval to implement backpressure.
	                if (typeof this._channel.bufferedAmountLowThreshold !== 'number') {
	                    this._interval = setInterval(() => this._onInterval(), 150);
	                    if (this._interval.unref) this._interval.unref();
	                }
	                this._debug('connect');
	                this.emit('connect');
	            });
	        };
	        findCandidatePair();
	    }
	    _onInterval() {
	        if (!this._cb || !this._channel || this._channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
	            return;
	        }
	        this._onChannelBufferedAmountLow();
	    }
	    _onSignalingStateChange() {
	        if (this.destroyed) return;
	        if (this._pc.signalingState === 'stable' && !this._firstStable) {
	            this._isNegotiating = false;
	            // HACK: Firefox doesn't yet support removing tracks when signalingState !== 'stable'
	            this._debug('flushing sender queue', this._sendersAwaitingStable);
	            this._sendersAwaitingStable.forEach(sender => {
	                this._pc.removeTrack(sender);
	                this._queuedNegotiation = true;
	            });
	            this._sendersAwaitingStable = [];
	            if (this._queuedNegotiation) {
	                this._debug('flushing negotiation queue');
	                this._queuedNegotiation = false;
	                this._needsNegotiation(); // negotiate again
	            }
	            this._debug('negotiate');
	            this.emit('negotiate');
	        }
	        this._firstStable = false;
	        this._debug('signalingStateChange %s', this._pc.signalingState);
	        this.emit('signalingStateChange', this._pc.signalingState);
	    }
	    _onIceCandidate(event) {
	        if (this.destroyed) return;
	        if (event.candidate && this.trickle) {
	            this.emit('signal', {
	                candidate: {
	                    candidate: event.candidate.candidate,
	                    sdpMLineIndex: event.candidate.sdpMLineIndex,
	                    sdpMid: event.candidate.sdpMid
	                },
	                candidateObj: event.candidate
	            });
	        } else if (!event.candidate && !this._iceComplete) {
	            this._iceComplete = true;
	            this.emit('_iceComplete');
	        }
	        // as soon as we've received one valid candidate start timeout
	        if (event.candidate) {
	            this._startIceCompleteTimeout();
	        }
	    }
	    _onChannelMessage(event) {
	        if (this.destroyed) return;
	        var data = event.data;
	        if (data instanceof ArrayBuffer) data = Buffer.from(data);
	        this.push(data);
	    }
	    _onChannelBufferedAmountLow() {
	        if (this.destroyed || !this._cb) return;
	        this._debug('ending backpressure: bufferedAmount %d', this._channel.bufferedAmount);
	        var cb = this._cb;
	        this._cb = null;
	        cb(null);
	    }
	    _onChannelOpen() {
	        if (this._connected || this.destroyed) return;
	        this._debug('on channel open');
	        this._channelReady = true;
	        this._maybeReady();
	    }
	    _onChannelClose() {
	        if (this.destroyed) return;
	        this._debug('on channel close');
	        this.destroy();
	    }
	    _onStream(event) {
	        this.emit('stream', event.stream);
	    }
	    _onTrack(event) {
	        if (this.destroyed) return;
	        event.streams.forEach(eventStream => {
	            this._debug('on track');
	            this.emit('track', event.track, eventStream);
	            this._remoteTracks.push({
	                track: event.track,
	                stream: eventStream
	            });
	            if (this._remoteStreams.some(remoteStream => {
	                    return remoteStream.id === eventStream.id;
	                })) return; // Only fire one 'stream' event, even though there may be multiple tracks per stream
	            this._remoteStreams.push(eventStream);
	            queueMicrotask(() => {
	                this.emit('stream', eventStream); // ensure all tracks have been added
	            });
	        });
	    }
	    _debug() {
	        if (!this.debugEnabled) return;
	        var args = [].slice.call(arguments);
	        args[0] = '[' + this._id + '] ' + args[0];
	        //debug.apply(null, args)
	        console.log.apply(null, args);
	        //console.log("%c%s", args);
	    }

	    /**
	     * Dynamically sets the codec preferences using the setCodecPreferences api
	     * Firstly collects the codec capabilities
	     */
	    setCodecPreferences(chosenCodecs) {
	        this.codecFilterFallback = false;
	        if (!PeerUtils.supportCodecPreferences) return;
	        const transceivers = this._pc.getTransceivers();
	        transceivers.forEach(transceiver => {
	            const kind = transceiver.sender.track.kind;
	            let sendCodecs = RTCRtpSender.getCapabilities(kind).codecs,
	                recvCodecs = RTCRtpReceiver.getCapabilities(kind).codecs,
	                codec = chosenCodecs[kind];
	            sendCodecs = SDPUtils.preferCodec(sendCodecs, codec);
	            recvCodecs = SDPUtils.preferCodec(recvCodecs, codec);

	            //if an empty filter choose SDP mangling fallback. IOS returns an empty sdpFmtpLine the absolute idiots !
	            //Android has decided to not provide the same H264 level in the receive codecs as send codecs the idiots. Use fallback or setting preferences will fail. 
	            if (!sendCodecs.length || !recvCodecs.length) {
	                this.codecFilterFallback = true;
	                return;
	            }

	            const prefferredCodecs = this.chosenPrefferredCodecs = [...sendCodecs, ...recvCodecs];
	             //console.log("codecs ", prefferredCodecs);
	            transceiver.setCodecPreferences(prefferredCodecs);
	            //this.emit("codecs", kind, prefferredCodecs);
	        });
	    }

	    /**
	     * Dynamically sets the max bitrate using setParameters api
	     */
	    setMaxBitrate(type, maxBitrate) {
	        if (!PeerUtils.supportParameters) return;
	        const sender = this.getSender(type),
	            parameters = sender.getParameters();
	        if (!parameters.encodings) {
	            parameters.encodings = [{}];
	        }
	        if (maxBitrate === '') {
	            delete parameters.encodings[0].maxBitrate;
	        } else {
	            parameters.encodings[0].maxBitrate = maxBitrate * 1000;
	        }
	        //console.log("SET PARAMS", parameters);
	        sender.setParameters(parameters).then(() => {
	          this.emit("bitratechanged", parameters);
	            console.log("Bitrate set successfully");
	        }).catch(e => console.error(e));
	    }

	    setVideoEncodings(encodings) {
	            if (!PeerUtils.supportParameters) return;
	            const sender = this.getSender("video"),
	                parameters = sender.getParameters();
	           
	            parameters.encodings = encodings;
	            //console.log("SET PARAMS", parameters);
	            sender.setParameters(parameters).then(() => {
	              this.emit("simulcastset", parameters);
	             //   console.log("Simulcast set successfully", parameters);
	            }).catch(e => console.error(e));
	    }


	    static get WEBRTC_SUPPORT() {
	      return !!PeerUtils.RTCPeerConnection;
	    }

	    /**
	     * Expose peer and data channel config for overriding all Peer
	     * instances. Otherwise, just set opts.config or opts.channelConfig
	     * when constructing a Peer.
	     */
	    static get defaultConfig() {
	      return {
	          //dataChannel: true,
	          iceServers: [{
	              urls: 'stun:stun.l.google.com:19302'
	          }, {
	              urls: 'stun:global.stun.twilio.com:3478?transport=udp'
	          }],
	          sdpSemantics: 'unified-plan'
	      };
	    }

	    static get channelConfig() {
	      return {};
	    }

	    static get supportParameters() {
	      return PeerUtils.supportParameters;
	    }
	}

	exports.Peer = Peer;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
