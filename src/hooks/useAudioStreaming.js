// hooks/useAudioStreaming.js
// Hook này chịu trách nhiệm thu âm từ microphone, đóng gói thành các chunk nhị phân tối ưu và gửi thẳng lên MQTT topic dành cho âm thanh
import { useRef } from 'react';

// SỬA LỖI: Đổi myClientId thành myAudioId cho khớp với App.jsx
export default function useAudioStreaming(mqttClient, activeChannelId, myAudioId) {
  const mediaRecorderRef = useRef(null);
  const seqRef = useRef(0); // uint16 sequence number cho mỗi chunk âm thanh, giúp nhận diện và sắp xếp đúng thứ tự

  // Hàm bắt đầu thu âm
  const startRecording = async () => {
    try {
      // 1. Xin quyền truy cập Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Ép trình duyệt dùng bộ nén Opus để tiết kiệm băng thông tối đa
      // Đáp ứng tiêu chí Data Efficiency của Hackathon
      const options = { mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 8000 // Giảm bitrate xuống mức thấp nhất có thể để tiết kiệm băng thông
       };
      const recorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = recorder;

      // 3. Mỗi khi có một "chunk" âm thanh được tạo ra
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && mqttClient) {
          // 1. Chuyển Blob thành ArrayBuffer và ép về Uint8Array
          const arrayBuffer = await event.data.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          /* 2. TẠO GÓI TIN TỐI ƯU BĂNG THÔNG: 
          [ 1 byte senderId ]
          [ 2 bytes seq (uint16, big-endian) ]
          [ 4 bytes tsMs (uint32, milliseconds mod 2^32) ]
          [ webm_chunk... ]
          */
          // ---- header fields ----
          const seq = seqRef.current & 0xffff;
          seqRef.current = (seqRef.current + 1) & 0xffff;

          const ts = Date.now() >>> 0; // uint32 wrap

          // payload = 1 + 2 + 4 + audio
          const payload = new Uint8Array(7 + audioBytes.length);

          payload[0] = myAudioId;

          // seq uint16 big-endian
          payload[1] = (seq >>> 8) & 0xff;
          payload[2] = seq & 0xff;

          // ts uint32 big-endian
          payload[3] = (ts >>> 24) & 0xff;
          payload[4] = (ts >>> 16) & 0xff;
          payload[5] = (ts >>> 8) & 0xff;
          payload[6] = ts & 0xff;

          payload.set(audioBytes, 7);
          
          // 3. Publish thẳng lên một topic dành riêng cho âm thanh
          const audioTopic = `skytrac/audio/${activeChannelId}`;
          mqttClient.publish(audioTopic, payload);
          
          console.log(`📤 Đã gửi 1 chunk nhị phân: ${payload.byteLength} bytes lên ${audioTopic}`);
        }
      };

      // 4. Băm nhỏ âm thanh: Cứ 60ms xuất ra 1 chunk để gửi đi (giúp giảm độ trễ)
      recorder.start(60); // Cố gắng tạo chunk mỗi 60ms để có thể gửi đi nhanh hơn, giảm độ trễ tổng thể 
      console.log('🎤 Bắt đầu thu âm...');
      console.log('🎤 Bắt đầu thu âm với định dạng THỰC TẾ:', recorder.mimeType);

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
    }
  };

  return { startRecording, stopRecording };
}