export default class RingBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = new Float32Array(size);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;
  }

  push(data) {
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writeIndex] = data[i];
      this.writeIndex = (this.writeIndex + 1) % this.size;

      if (this.available < this.size) {
        this.available++;
      } else {
        this.readIndex = (this.readIndex + 1) % this.size;
      }
    }
  }

  pop(output) {
    const len = output.length;

    for (let i = 0; i < len; i++) {
      if (this.available > 0) {
        output[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.size;
        this.available--;
      } else {
        output[i] = 0;
      }
    }
  }

  getAvailable() {
    return this.available;
  }

  clear() {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;
  }
}