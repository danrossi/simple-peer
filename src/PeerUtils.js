export default class PeerUtils {
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
}