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

// ── thud — soft low body, barely any snap ────────────────────────────
{
  const b = zeros(0.45);
  ping(b, 0, 82, 0.9, 14, -0.25); // low body, pitch sags
  ping(b, 0, 55, 0.5, 10, -0.15);
  noiseBurst(b, 0, 0.18, 90, 0.08); // dull tap
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

// ── glass — crack + bright inharmonic ring ───────────────────────────
{
  const b = zeros(0.9);
  noiseBurst(b, 0, 0.8, 140, 0.9);
  // Inharmonic partials = the "glassy" signature
  ping(b, 0, 2437, 0.4, 9);
  ping(b, 0, 3671, 0.33, 11);
  ping(b, 0, 5213, 0.26, 13);
  ping(b, 0, 6841, 0.18, 15);
  ping(b, 0.005, 1531, 0.22, 8);
  writeWav("glass", Array.from(b));
}

// ── shatter — a shower of glass pings over a noise wash ──────────────
{
  const b = zeros(1.4);
  noiseBurst(b, 0, 0.9, 26, 0.85); // initial burst
  noiseBurst(b, 0.05, 0.35, 8, 0.5); // falling debris wash
  // 28 randomized shards, front-loaded
  for (let k = 0; k < 28; k++) {
    const t0 = Math.pow(Math.random(), 1.8) * 0.7;
    const f = 1800 + Math.random() * 6500;
    ping(b, t0, f, 0.1 + Math.random() * 0.22, 18 + Math.random() * 25);
  }
  writeWav("shatter", Array.from(b));
}

// ── wind — swelling filtered howl ────────────────────────────────────
{
  const b = zeros(1.5);
  let lp = 0,
    lp2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    // swell in, sag out
    const env = Math.min(1, t / 0.5) * Math.exp(-Math.max(0, t - 0.8) * 2.2);
    const w = Math.random() * 2 - 1;
    // two cascaded one-poles → dark rumble; alpha wobbles = gust texture
    const a = 0.045 + 0.03 * Math.sin(2 * Math.PI * 1.7 * t);
    lp += a * (w - lp);
    lp2 += 0.08 * (lp - lp2);
    b[i] = lp2 * env * 7.5;
  }
  // faint whistle on top
  ping(b, 0.3, 880, 0.06, 3, 0.4);
  writeWav("wind", Array.from(b));
}

// ── chaching — register bell double-hit (revenue mode) ───────────────
{
  const b = zeros(0.7);
  for (const [t0, a] of [
    [0, 0.5],
    [0.09, 0.65],
  ]) {
    ping(b, t0, 1318.5, a, 10); // E6
    ping(b, t0, 1760, a * 0.8, 10); // A6
    ping(b, t0, 2637, a * 0.4, 14);
    noiseBurst(b, t0, 0.12, 200, 0.9);
  }
  writeWav("chaching", Array.from(b));
}

console.log("\ndone →", OUT);
