import { useEffect, useRef } from "react";

export default function useWebRTCAudio(client, activeChannelId, myAudioId, audioPlayerRef) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());

  useEffect(() => {
    if (!client || !activeChannelId || !audioPlayerRef.current) return;

    const signalTopic = `skytrac/webrtc/${activeChannelId}`;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // basic STUN
      ],
    });
    pcRef.current = pc;

    // Remote audio -> audio element
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((t) => remoteStreamRef.current.addTrack(t));
      audioPlayerRef.current.srcObject = remoteStreamRef.current;
      audioPlayerRef.current.play?.().catch(() => {});
    };

    // Send ICE candidates over MQTT
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      client.publish(
        signalTopic,
        JSON.stringify({ type: "ice", from: myAudioId, candidate: event.candidate })
      );
    };

    // Subscribe to signaling
    client.subscribe(signalTopic);

    const onSignalMessage = async (topic, msg) => {
      if (topic !== signalTopic) return;

      const data = JSON.parse(msg.toString());
      if (data.from === myAudioId) return;

      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Ensure we have local stream to answer with (receive-only also possible)
        if (!localStreamRef.current) {
          localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current.getTracks().forEach((t) => {
            t.enabled = false; // start muted until PTT
            pc.addTrack(t, localStreamRef.current);
          });
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        client.publish(
          signalTopic,
          JSON.stringify({ type: "answer", from: myAudioId, sdp: pc.localDescription })
        );
      }

      if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }

      if (data.type === "ice") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      }
    };

    client.on("message", onSignalMessage);

    // Optional: "caller" creates offer immediately (you need a rule who starts)
    const startOffer = async () => {
      // get local mic once on join (keeps latency low)
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current.getTracks().forEach((t) => {
          t.enabled = false; // start muted until PTT
          pc.addTrack(t, localStreamRef.current);
        });
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      client.publish(
        signalTopic,
        JSON.stringify({ type: "offer", from: myAudioId, sdp: pc.localDescription })
      );
    };

    // simplest rule: everyone sends an offer on join (can cause glare in multi-peer)
    startOffer().catch(() => {});

    return () => {
      client.unsubscribe(signalTopic);
      client.off("message", onSignalMessage);

      pcRef.current?.close();
      pcRef.current = null;

      // stop mic when leaving channel (optional)
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;

      remoteStreamRef.current = new MediaStream();
    };
  }, [client, activeChannelId, myAudioId, audioPlayerRef]);

  // PTT: just toggle mic track
  const setTalking = (isTalking) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = isTalking));
  };

  return { setTalking };
}