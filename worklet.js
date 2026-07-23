// Cyclo AudioWorklet player (split-brain Spike 1).
//
// This is the browser's real-time audio device layer. The SHARED WASM engine (the real
// VoicePool + MasterChain) renders interleaved-stereo blocks on the main thread and posts
// them here; this processor is the sample-accurate clock that streams them to the speakers.
// A ring buffer decouples the two: the audio thread never blocks on the main thread, and a
// generous lead (the pump keeps ~0.25 s queued ahead) absorbs main-thread jank.
//
// (A later parity step can move the WASM instance INSIDE this worklet — instantiating the
// module in AudioWorkletGlobalScope — for a fully self-contained audio thread; that needs
// COOP/COEP + SharedArrayBuffer, so it is deferred. This postMessage path deploys on plain
// GitHub Pages today and the SOUND is already 100% the shared engine.)

class CycloPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.cap = 0;
    this.buf = null;          // interleaved stereo ring
    this.read = 0;
    this.write = 0;
    this.avail = 0;           // frames available
    this.playing = false;
    this.framesPlayed = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  ensure(frames) {
    // grow the ring to hold `frames` interleaved-stereo samples if needed
    const need = frames * 2;
    if (this.cap >= need) return;
    const cap = Math.max(need, this.cap ? this.cap * 2 : 48000 * 2);
    const nb = new Float32Array(cap);
    // copy existing (linearised) content
    let n = this.avail;
    for (let i = 0; i < n; i++) {
      const src = ((this.read + i) % (this.cap / 2)) * 2;
      nb[i * 2] = this.buf[src];
      nb[i * 2 + 1] = this.buf[src + 1];
    }
    this.buf = nb;
    this.cap = cap;
    this.read = 0;
    this.write = this.avail;
  }

  onMessage(m) {
    if (m.type === 'chunk') {
      const data = m.data;                 // Float32Array interleaved L,R,L,R...
      const frames = data.length / 2;
      this.ensure(this.avail + frames + 256);
      const ringFrames = this.cap / 2;
      for (let i = 0; i < frames; i++) {
        const w = (this.write % ringFrames) * 2;
        this.buf[w] = data[i * 2];
        this.buf[w + 1] = data[i * 2 + 1];
        this.write = (this.write + 1) % ringFrames;
      }
      this.avail += frames;
    } else if (m.type === 'play') {
      this.playing = true;
      this.framesPlayed = 0;
    } else if (m.type === 'stop') {
      this.playing = false;
      this.read = this.write = this.avail = 0;   // flush
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const n = L.length;
    const ringFrames = this.cap ? this.cap / 2 : 0;

    if (!this.playing || this.avail <= 0 || !this.buf) {
      for (let i = 0; i < n; i++) { L[i] = 0; if (R !== L) R[i] = 0; }
      return true;
    }

    let peak = 0;
    for (let i = 0; i < n; i++) {
      if (this.avail > 0) {
        const r = (this.read % ringFrames) * 2;
        const l = this.buf[r], rr = this.buf[r + 1];
        L[i] = l;
        if (R !== L) R[i] = rr;
        const a = Math.abs(l) > Math.abs(rr) ? Math.abs(l) : Math.abs(rr);
        if (a > peak) peak = a;
        this.read = (this.read + 1) % ringFrames;
        this.avail--;
        this.framesPlayed++;
      } else {
        L[i] = 0; if (R !== L) R[i] = 0;   // underrun -> silence
      }
    }
    // report level + queue depth occasionally (for the VU meter + pump backpressure)
    if ((this.framesPlayed & 1023) < n) {
      this.port.postMessage({ type: 'meter', peak, queued: this.avail, played: this.framesPlayed });
    }
    return true;
  }
}

registerProcessor('cyclo-player', CycloPlayer);
