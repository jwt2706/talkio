import { useEffect, useRef } from "react";
import OpusWorker from "./opus.worker?worker";
import { unpackPacket } from "./rtpPacket";
import { JitterBuffer } from "./jitterBuffer";

export function usePttAudioRx({ mqttClient, channelId }) {
  const audioCtxRef = useRef(null);
  const playoutNodeRef = useRef(null);
  const workerRef = useRef(null);

  // one jitter buffer per ssrc
  const jbMapRef = useRef(new Map());

  useEffect(() => {
    if (!mqttClient) return;

    let cancelled = false;
    const topic = `skytrac/rtp/${channelId}`;

    async function startAudio() {
      const ac = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ac;

      await ac.audioWorklet.addModule(new URL("./audioPlayoutWorklet.js", import.meta.url));
      const playout = new AudioWorkletNode(ac, "playout-processor");
      playout.connect(ac.destination);
      playoutNodeRef.current = playout;

      const w = new OpusWorker();
      workerRef.current = w;

      w.postMessage({ type: "init", sampleRate: 16000, channels: 1, frameSize: 320, bitrate: 12000 });

      // Decode callback: push PCM to playout worklet
      w.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "decoded") {
          // Float32Array
          playout.port.postMessage({ type: "push", pcm: msg.pcm }, [msg.pcm.buffer]);
        }
      };

      // Playout scheduler: every 20ms pop jitter buffers
      const interval = setInterval(() => {
        if (cancelled) return;

        for (const [ssrc, jb] of jbMapRef.current.entries()) {
          const res = jb.popNext();
          if (res.kind === "WAIT") continue;

          if (res.kind === "PKT") {
            workerRef.current?.postMessage(
              { type: "decode", id: (Math.random() * 1e9) | 0, opus: res.pkt.opus },
              [res.pkt.opus.buffer]
            );
          } else if (res.kind === "PLC") {
            workerRef.current?.postMessage({ type: "plc", id: (Math.random() * 1e9) | 0 });
          }
        }
      }, 20);

      // MQTT subscribe
      mqttClient.subscribe(topic);

      const onMessage = (t, payload) => {
        if (cancelled) return;
        if (t !== topic) return;

        const pkt = unpackPacket(new Uint8Array(payload));
        if (!pkt) return;

        // jitter buffer per speaker
        let jb = jbMapRef.current.get(pkt.ssrc);
        if (!jb) {
          jb = new JitterBuffer({ targetMs: 120, maxMs: 220, dropLateMs: 1000 });
          jbMapRef.current.set(pkt.ssrc, jb);
        }
        jb.push(pkt);
      };

      mqttClient.on("message", onMessage);

      return () => {
        clearInterval(interval);
        mqttClient.unsubscribe(topic);
        mqttClient.removeListener("message", onMessage);
      };
    }

    let cleanup = null;
    startAudio()
      .then((c) => { cleanup = c; })
      .catch(console.error);

    return () => {
      cancelled = true;
      try { cleanup?.(); } catch {}
      try { playoutNodeRef.current?.disconnect(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      try { workerRef.current?.terminate(); } catch {}
      playoutNodeRef.current = null;
      audioCtxRef.current = null;
      workerRef.current = null;
      jbMapRef.current.clear();
    };
  }, [mqttClient, channelId]);
}