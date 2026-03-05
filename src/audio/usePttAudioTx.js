import { useEffect, useRef } from "react";
import OpusWorker from "./opus.worker?worker";
import { packPacket, FLAGS } from "./rtpPacket";

export function usePttAudioTx({ mqttClient, channelId, talking, ssrc }) {
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const workerRef = useRef(null);

  const seqRef = useRef(0);
  const tsRef = useRef(0); // sample clock
  const prevOpusRef = useRef(null);

  useEffect(() => {
    if (!talking) return;

    let cancelled = false;

    async function start() {
      // 1) audio context
      const ac = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ac;

      // 2) mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = ac.createMediaStreamSource(stream);

      // 3) worklet
      await ac.audioWorklet.addModule(new URL("./audioCaptureWorklet.js", import.meta.url));
      const node = new AudioWorkletNode(ac, "capture-processor");
      workletNodeRef.current = node;

      // 4) opus worker
      const w = new OpusWorker();
      workerRef.current = w;

      w.postMessage({
        type: "init",
        sampleRate: 16000,
        channels: 1,
        frameSize: 320,
        bitrate: 12000,
      });

      // 5) connect graph (no output needed)
      src.connect(node);

      // 6) handle frames
      const pending = new Map();
      let nextId = 1;

      w.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "encoded") {
          const { id, opus } = msg;
          const ctx = pending.get(id);
          if (!ctx) return;
          pending.delete(id);

          const nowMs = Date.now() >>> 0;
          const seq = seqRef.current & 0xffff;
          seqRef.current = (seqRef.current + 1) & 0xffff;

          const tsSamples = tsRef.current >>> 0;
          tsRef.current = (tsRef.current + 320) >>> 0;

          // optional redundancy: attach previous opus frame
          const red = prevOpusRef.current;
          prevOpusRef.current = opus; // current becomes previous

          const flags = FLAGS.DTX; // set flags as you want; DTX here just as example
          const pkt = packPacket({
            ssrc,
            seq,
            tsSamples,
            frameSamples: 320,
            sendTimeMs: nowMs,
            flags: red ? (flags | FLAGS.REDUNDANT) : flags,
            opus,
            red,
          });

          // MQTT publish
          const topic = `skytrac/rtp/${channelId}`;
          mqttClient?.publish(topic, pkt);
        }
      };

      node.port.onmessage = (e) => {
        if (cancelled) return;
        const msg = e.data;
        if (msg.type === "frame") {
          const id = nextId++;
          pending.set(id, true);
          // send to opus worker (transfer)
          w.postMessage({ type: "encode", id, pcm: msg.frame }, [msg.frame.buffer]);
        }
      };
    }

    start().catch(console.error);

    return () => {
      cancelled = true;
      // cleanup
      try { workletNodeRef.current?.disconnect(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      try { workerRef.current?.terminate(); } catch {}
      workletNodeRef.current = null;
      audioCtxRef.current = null;
      workerRef.current = null;
      prevOpusRef.current = null;
      seqRef.current = 0;
      tsRef.current = 0;
    };
  }, [talking, mqttClient, channelId, ssrc]);
}