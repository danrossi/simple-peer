//import debug from 'debug';
//import stream from 'readable-stream';

import EventEmitter from './events/EventEmitter';

import SDPUtils from './utils/SdpUtils';
import PeerUtils from './utils/PeerUtils';


const MAX_BUFFERED_AMOUNT = 64 * 1024,
ICECOMPLETE_TIMEOUT = 5 * 1000,
CHANNEL_CLOSING_TIMEOUT = 5 * 1000;



// HACK: Filter trickle lines when trickle is disabled #354
function filterTrickle(sdp) {
    return sdp.replace(/a=ice-options:trickle\s\n/g, '')
}

function makeError(message, code) {
    var err = new Error(message)
    err.code = code
    return err
}

function warn(message) {
    console.warn(message)
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
        this._sendersAwaitingStable = []
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
        })
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
        })
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
            this._debug('on channel close');
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
        }
        const onSuccess = () => {
            this._debug('createOffer success');
            if (this.destroyed) return;
            if (this.trickle || this._iceComplete) sendOffer();
            else this.once('_iceComplete', sendOffer); // wait for candidates
        }
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
        })
    }
    _requestMissingTransceivers() {
        if (this._pc.getTransceivers) {
            this._pc.getTransceivers().forEach(transceiver => {
                if (!transceiver.mid && transceiver.sender.track && !transceiver.requested) {
                    transceiver.requested = true // HACK: Safari returns negotiated transceivers with a null mid
                    this.addTransceiver(transceiver.sender.track.kind);
                }
            })
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
            }
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
        })
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
                    Object.assign(report, value)
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
                })
                cb(null, reports);
            }, err => cb(err))
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
                    })
                    report.id = result.id;
                    report.type = result.type;
                    report.timestamp = result.timestamp;
                    reports.push(flattenValues(report));
                });
                cb(null, reports);
            }, err => cb(err))
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
                    foundSelectedCandidatePair = true
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
                }
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
                })
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
            })
        }
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
            })
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
        })
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

//module.exports = Peer
export { Peer };