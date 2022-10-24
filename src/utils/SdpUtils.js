import { Parser, Writer } from 'sdp-transform';
import PeerUtils from './PeerUtils';

/**
 * SDP Codec and bitrate utils
 */
export default class SDPUtils {

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
  static  setOpusConfig(media, opusConfig, opusChannels = null) {
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
            //add multichannel opus
            if (opusChannels > 2) {
              media.rtp[0].codec = "multiopus";
              media.rtp[0].encoding = opusChannels;
            }
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
       const filterCodecs = (!PeerUtils.supportCodecPreference || codecFilterFallback) && preferredCodecs;
      if (filterCodecs || config.maxVideoBitrate || config.opusConfig) {
          const sdp = Parser.parse(description.sdp);
          sdp.media.map(media => {  
            switch (media.type) {
              case "video":
              case "audio":
              //for browsers that don't support setCodecPreferences, SDP transformation is required
              if (filterCodecs) this.filterCodecs(media, preferredCodecs);
              if (config.opusConfig && media.type == "audio") this.setOpusConfig(media, config.opusConfig, config.opusChannels);
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