// hooks/useAudioStreaming.js
import { useRef } from 'react';

// FIX BUG: Change myClientId to myAudioId to match App.jsx
export default function useAudioStreaming(mqttClient, activeChannelId, myAudioId) {
  const mediaRecorderRef = useRef(null);

  // Function to start recording
  const startRecording = async () => {
    try {
      // 1. Request access to the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Force browser to use Opus codec to maximize bandwidth efficiency
      // Meet the Hackathon's Data Efficiency criteria
      const options = { mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 8000 // Lower bitrate as much as possible to save bandwidth
       };
      const recorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = recorder;

      // 3. Whenever an audio "chunk" is generated
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && mqttClient) {
          // 1. Convert Blob to ArrayBuffer and coerce to Uint8Array
          const arrayBuffer = await event.data.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          // 2. CREATE BANDWIDTH-OPTIMIZED PACKET: 1 Byte ID + Audio
          const payload = new Uint8Array(1 + audioBytes.length);
          payload[0] = myAudioId; // FIX BUG: Use the correct variable myAudioId
          payload.set(audioBytes, 1); // Fill audio data starting from the 2nd byte
          
          // 3. Publish directly to an audio-specific topic
          const audioTopic = `skytrac/audio/${activeChannelId}`;
          mqttClient.publish(audioTopic, payload);
          
          console.log(`📤 Sent 1 binary chunk: ${payload.byteLength} bytes to ${audioTopic}`);
        }
      };

      // 4. Fragment audio: emit a chunk every 500ms to send (helps reduce latency)
      recorder.start(500); 
      console.log('🎤 Recording started...');
      console.log('🎤 Recording started with actual format:', recorder.mimeType);

    } catch (err) {
      console.error('Microphone access error:', err);
    }
  };

  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Stop mic tracks to release the "recording" indicator in the browser
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      console.log('🛑 Recording stopped.');
    }
  };

  return { startRecording, stopRecording };
}