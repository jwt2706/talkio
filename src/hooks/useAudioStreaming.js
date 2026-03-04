// hooks/useAudioStreaming.js
import { useRef, useState } from 'react';

export default function useAudioStreaming(mqttClient, activeChannelId, myClientId) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Hàm bắt đầu thu âm
  const startRecording = async () => {
    try {
      // 1. Xin quyền truy cập Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Ép trình duyệt dùng bộ nén Opus để tiết kiệm băng thông tối đa
      // Đây chính là điểm ăn tiền cho Data Efficiency
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const recorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = recorder;
      //audioChunksRef.current = [];

      // 3. Mỗi khi có một "chunk" âm thanh được tạo ra
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && mqttClient) {
          // 1. Chuyển Blob thành ArrayBuffer
          const arrayBuffer = await event.data.arrayBuffer();
          
          // 2. Ép kiểu về Uint8Array (mảng byte) để MQTT có thể gửi đi
          const buffer = new Uint8Array(arrayBuffer);

          // 3. Publish thẳng lên một topic dành riêng cho âm thanh
          const audioTopic = `skytrac/audio/${activeChannelId}`;
          mqttClient.publish(audioTopic, buffer);
          
          console.log(`📤 Đã gửi 1 chunk nhị phân: ${buffer.byteLength} bytes lên ${audioTopic}`);
        }
      };

      // 4. Băm nhỏ âm thanh: Cứ 500ms xuất ra 1 chunk để gửi đi (giúp giảm độ trễ)
      recorder.start(500); 
      console.log('🎤 Bắt đầu thu âm...');

    } catch (err) {
      console.error('Lỗi truy cập Microphone:', err);
    }
  };

  // Hàm dừng thu âm
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Tắt các track của mic để nhả biểu tượng "đang ghi âm" trên trình duyệt
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      console.log('🛑 Đã dừng thu âm.');
      
      // Sau khi dừng, ta có thể test phát lại đoạn vừa thu
      //playRecordedChunks();
    }
  };

  // Hàm test: Ghép các chunks lại và phát thử trên chính máy mình
  const playRecordedChunks = () => {
    if (audioChunksRef.current.length === 0) return;
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    console.log('🔊 Đang phát lại để test chất lượng nén Opus...');
    audio.play();
  };

  return { startRecording, stopRecording };
}