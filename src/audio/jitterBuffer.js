export class JitterBuffer {
  constructor({
    frameMs = 20,
    targetMs = 120,
    maxMs = 220,
    dropLateMs = 1000,
  } = {}) {
    this.frameMs = frameMs;
    this.targetMs = targetMs;
    this.maxMs = maxMs;
    this.dropLateMs = dropLateMs;

    this.map = new Map(); // tsSamples -> packet
    this.baseTs = null;
    this.expectedTs = null;
    this.frameSamples = 320; // will be set from first packet
  }

  reset() {
    this.map.clear();
    this.baseTs = null;
    this.expectedTs = null;
  }

  push(pkt) {
    const now = Date.now() >>> 0;
    const age = (now - pkt.sendTimeMs) >>> 0;

    // Drop too late => never "listen to the past"
    if (age > this.dropLateMs) return;

    this.frameSamples = pkt.frameSamples || this.frameSamples;
    this.map.set(pkt.tsSamples, pkt);

    // Anti-backlog: keep only up to max window
    if (this.baseTs !== null) {
      const maxFrames = Math.round(this.maxMs / this.frameMs);
      const maxWindowSamples = maxFrames * this.frameSamples;

      for (const ts of this.map.keys()) {
        const diff = (ts - this.baseTs) >>> 0;
        if (diff > maxWindowSamples) this.map.delete(ts);
      }
    }
  }

  _enoughToStart() {
    const needFrames = Math.round(this.targetMs / this.frameMs);
    return this.map.size >= needFrames;
  }

  _startIfNeeded() {
    if (this.baseTs !== null) return true;
    if (!this._enoughToStart()) return false;

    const sorted = [...this.map.keys()].sort((a, b) => (a - b) | 0);
    this.baseTs = sorted[0];
    this.expectedTs = this.baseTs;
    return true;
  }

  popNext() {
    if (!this._startIfNeeded()) return { kind: "WAIT" };

    const pkt = this.map.get(this.expectedTs) || null;
    if (pkt) this.map.delete(this.expectedTs);

    this.expectedTs = (this.expectedTs + this.frameSamples) >>> 0;

    if (pkt) return { kind: "PKT", pkt };
    return { kind: "PLC" }; // missing => ask decoder PLC
  }
}