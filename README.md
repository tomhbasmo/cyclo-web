# Cyclo — web (Spike 0)

### ▶ Live: **https://tomhbasmo.github.io/cyclo-web/**

Cyclo is a mobile-first, live-coding sampler DAW — *record any sound, make a beat, then go as
deep as code if you want.* This repo hosts an early **web build**: the app's real pattern
engine — its **C++ core, compiled to WebAssembly** — running in your browser.

Open the link, press **Play**, and edit the mini-notation live. Every event you hear is
scheduled by the actual Cyclo core (the same code that runs the native app), compiled to WASM
with zero changes. The drum sounds are placeholder Web Audio voices for now; the real engine
DSP moves into an AudioWorklet in the next step.

---

This repository contains only the **compiled artifact** (`cyclo_web.js` + the harness
`index.html`) — **not** the Cyclo source. See [`LICENSE`](LICENSE) (all rights reserved) and
[`NOTICE.md`](NOTICE.md) (Emscripten / musl runtime credits).
