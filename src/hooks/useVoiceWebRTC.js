import { useRef, useEffect } from "react";
import Peer from "simple-peer";

export default function useVoiceWebRTC(channelId, clientRef) {

  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    async function initMic() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        console.log("Mic tracks:", streamRef.current.getAudioTracks());
        console.log("Microphone ready");
      } catch (err) {
        console.error("Mic access error", err);
      }
    }

    initMic();
  }, []);

  const startTalking = () => {

    if (!streamRef.current) return;
    if (!clientRef.current) return;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: streamRef.current,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }]
        }
      });

    peer.on("signal", data => {

      const payload = JSON.stringify({
        action: "webrtc_signal",
        signal: data
      });

      clientRef.current.publish(
        `skytrac/talkgroup/${channelId}`,
        payload
      );
    });

    peer.on("stream", remoteStream => {
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play();
    });

    peerRef.current = peer;
  };

  const stopTalking = () => {

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  };

  const handleSignal = signal => {

    if (!peerRef.current) return;

    peerRef.current.signal(signal);
  };

  return {
    startTalking,
    stopTalking,
    handleSignal
  };
}