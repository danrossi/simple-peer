const supportCodecPreferences = ('RTCRtpTransceiver' in window && 'setCodecPreferences' in window.RTCRtpTransceiver.prototype);
const supportParameters = ('setParameters' in window.RTCRtpSender.prototype);

exports.supportCodecPreferences = supportCodecPreferences;
exports.supportParameters = supportParameters;