/**
 * Generate the alarm-sound ladder procedurally → public/sounds/*.wav
 *
 * Severity ladder (hail size → sound):
 *   thud     ~1.0"  soft impact (marble on shingles)
 *   thunk    ~1.5"  solid hit (golf ball on a hood)
 *   crack    ~2.0"  sharp snap (windshield chip)
 *   glass    ~2.5"  glass crack + ring
 *   shatter  ≥3.0"  full glass shatter
 *   wind             gust howl (wind alerts, Phase 2)
 *   chaching         optional "revenue mode" layer for home-turf hits
 *
 * Pure-node PCM synthesis (no deps). 22050 Hz mono 16-bit — each file is
 * 20-60 KB. Rerun `node scripts/gen-alarm-sounds.cjs` to regenerate; swap
 * any file for a studio sample later without touching code.
 */
const fs = require("fs");
const path = require("path");

const SR = 22050;
const OUT = path.join(__dirname, "..", "public", "sounds");
fs.mkdirSync(OUT, { recursive: true });

function writeWav(name, samples) {
  // Normalize to 0.9 peak — the raw synthesis can sum past 1.0, and a
  // hard clamp would clip into crunchy distortion.
  const rawPeak = Math.max(...samples.map(Math.abs)) || 1;
  const g = 0.9 / rawPeak;
  samples = samples.map((s) => s * g);
  // convert float [-1,1] → int16
  const n = samples.length;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    let v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE((v * 32767) | 0, i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0);
  hdr.writeUInt32LE(36 + data.length, 4);
  hdr.write("WAVE", 8);
  hdr.write("fmt ", 12);
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20); // PCM
  hdr.writeUInt16LE(1, 22); // mono
  hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 2, 28);
  hdr.writeUInt16LE(2, 32);
  hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36);
  hdr.writeUInt32LE(data.length, 40);
  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, Buffer.concat([hdr, data]));
  const peak = Math.max(...samples.map(Math.abs));
  const rms = Math.sqrt(samples.reduce((a, s) => a + s * s, 0) / n);
  console.log(
    `${name.padEnd(9)} ${(n / SR).toFixed(2)}s  peak=${peak.toFixed(2)} rms=${rms.toFixed(3)}  ${Math.round((44 + data.length) / 1024)}KB`
  );
}

const zeros = (sec) => new Float64Array(Math.round(sec * SR));

/** Exponentially decaying sine partial added into buf. */
function ping(buf, t0, freq, amp, decay, drift = 0) {
  const start = Math.round(t0 * SR);
  for (let i = start; i < buf.length; i++) {
    const t = (i - start) / SR;
    const f = freq * (1 + drift * t);
    buf[i] += amp * Math.exp(-t * decay) * Math.sin(2 * Math.PI * f * t);
  }
}

/** Decaying noise burst (optionally lowpassed by simple 1-pole). */
function noiseBurst(buf, t0, amp, decay, lpAlpha = 1) {
  const start = Math.round(t0 * SR);
  let lp = 0;
  for (let i = start; i < buf.length; i++) {
    const t = (i - start) / SR;
    const w = (Math.random() * 2 - 1) * amp * Math.exp(-t * decay);
    lp = lp + lpAlpha * (w - lp); // lpAlpha 1 = raw noise, small = darker
    buf[i] += lp;
  }
}

// ── thud — v2: real IMPACT (v1 was too soft). Hard attack transient +
//    deeper, punchier body. Still clearly the bottom of the ladder.
{
  const b = zeros(0.4);
  noiseBurst(b, 0, 0.6, 220, 0.35); // sharp slap attack (very short)
  ping(b, 0, 150, 0.7, 45, -0.5);   // knock transient
  ping(b, 0.004, 72, 1.1, 16, -0.3); // deep body, pitch sags
  ping(b, 0.004, 48, 0.7, 11, -0.2); // sub weight
  writeWav("thud", Array.from(b));
}

// ── thunk — bigger body + a knock ────────────────────────────────────
{
  const b = zeros(0.55);
  ping(b, 0, 110, 0.95, 12, -0.3);
  ping(b, 0, 68, 0.65, 9, -0.2);
  ping(b, 0, 210, 0.35, 30, -0.3); // knuckle
  noiseBurst(b, 0, 0.3, 70, 0.15);
  writeWav("thunk", Array.from(b));
}

// ── crack — sharp transient + short body ─────────────────────────────
{
  const b = zeros(0.5);
  noiseBurst(b, 0, 0.95, 160, 0.8); // the snap itself
  ping(b, 0, 320, 0.5, 40, -0.4);
  ping(b, 0, 1250, 0.3, 60);
  ping(b, 0.015, 95, 0.5, 12, -0.2); // body follows the snap
  writeWav("crack", Array.from(b));
}

// ── glass — v2: total rebuild ("the worst of the bunch"). The slow
//    inharmonic ring read as a cheap chime. New take = a mini-shatter:
//    one hard crack + a brief sprinkle of glass shards, short and dry —
//    same family as the 3"+ shatter he liked, scaled down.
{
  const b = zeros(0.65);
  noiseBurst(b, 0, 0.95, 150, 0.85); // the crack
  ping(b, 0, 310, 0.45, 45, -0.4);   // crack body
  // 9 quick shards, tightly front-loaded, FAST decays (no lingering tones)
  const shardT = [0.01, 0.03, 0.05, 0.08, 0.11, 0.15, 0.19, 0.24, 0.3];
  for (let k = 0; k < shardT.length; k++) {
    const f = 2200 + Math.random() * 4800;
    ping(b, shardT[k], f, 0.16 + Math.random() * 0.12, 40 + Math.random() * 25);
  }
  noiseBurst(b, 0.02, 0.18, 14, 0.5); // short debris wash
  writeWav("glass", Array.from(b));
}

// ── shatter — v2: keep the hit he liked, kill the "weird tones after".
//    The tail artifact was slow-decay pure sines ringing out past the
//    debris. Fixes: much faster shard decays, shards confined to the
//    first 0.45s, shorter buffer, and a global fade-out so NOTHING
//    rings past the wash.
{
  const b = zeros(1.05);
  noiseBurst(b, 0, 0.9, 26, 0.85);  // initial burst
  noiseBurst(b, 0.05, 0.35, 9, 0.5); // falling debris wash
  for (let k = 0; k < 26; k++) {
    const t0 = Math.pow(Math.random(), 2.0) * 0.45; // front-loaded, ends sooner
    const f = 1800 + Math.random() * 6200;
    ping(b, t0, f, 0.1 + Math.random() * 0.2, 38 + Math.random() * 30); // fast decay
  }
  // Global fade from 0.55s → end: guarantees a clean, tone-free tail.
  const fadeStart = Math.round(0.55 * SR);
  for (let i = fadeStart; i < b.length; i++) {
    const t = (i - fadeStart) / (b.length - fadeStart);
    b[i] *= Math.pow(1 - t, 1.6);
  }
  writeWav("shatter", Array.from(b));
}

// ── wind — v2: same howl, tightened from 1.5s to ~1.0s ("a little long").
{
  const b = zeros(1.0);
  let lp = 0,
    lp2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    // swell in faster, sag out sooner
    const env = Math.min(1, t / 0.32) * Math.exp(-Math.max(0, t - 0.55) * 3.2);
    const w = Math.random() * 2 - 1;
    // two cascaded one-poles → dark rumble; alpha wobbles = gust texture
    const a = 0.045 + 0.03 * Math.sin(2 * Math.PI * 2.1 * t);
    lp += a * (w - lp);
    lp2 += 0.08 * (lp - lp2);
    b[i] = lp2 * env * 7.5;
  }
  // faint whistle on top
  ping(b, 0.2, 880, 0.06, 5, 0.4);
  writeWav("wind", Array.from(b));
}

// ── chaching — v2: OLD SCHOOL mechanical register ("cha-CHING!"), not a
//    modern synth bell. Three-part anatomy of the real thing:
//      "cha"  — the lever/key clack (dry mechanical click)
//      "CHING"— ONE bright brass bell strike with inharmonic bell
//               partials ringing out
//      drawer — the wooden drawer slamming open right after (low thump
//               + slide rattle)
{
  const b = zeros(0.85);
  // "cha" — mechanical clack at t=0
  noiseBurst(b, 0, 0.55, 260, 0.7);
  ping(b, 0, 420, 0.3, 90, -0.3);
  // "CHING" — single bell strike at t=0.07. True bell partial ratios
  // (1, 2.76, 5.40, 8.93) off a ~1.9kHz strike tone.
  const F = 1870;
  ping(b, 0.07, F, 0.85, 6.5);
  ping(b, 0.07, F * 2.76, 0.4, 9);
  ping(b, 0.07, F * 5.4, 0.22, 13);
  ping(b, 0.07, F * 8.93, 0.1, 18);
  noiseBurst(b, 0.07, 0.2, 300, 0.95); // strike hammer noise
  // drawer slam at t=0.22 — low wooden thump + short slide rattle
  ping(b, 0.22, 105, 0.75, 22, -0.3);
  ping(b, 0.22, 62, 0.5, 15, -0.2);
  noiseBurst(b, 0.2, 0.3, 40, 0.25); // drawer slide
  writeWav("chaching", Array.from(b));
}

console.log("\ndone →", OUT);
