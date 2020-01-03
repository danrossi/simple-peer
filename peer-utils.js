const supportCodecPreferences = ('setCodecPreferences' in RTCRtpTransceiver.prototype);
const supportParameters = ('setParameters' in window.RTCRtpSender.prototype);

exports.supportCodecPreferences = supportCodecPreferences;
exports.supportParameters = supportParameters;