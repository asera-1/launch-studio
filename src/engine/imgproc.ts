// Portable pixel ops. Work on any CanvasRenderingContext2D (browser or node).

export interface GrainOptions {
  intensity?: number   // 0..100  how visible the grain is
  size?: number        // >=1     grain cell size in px (1 = fine, higher = chunky)
  density?: number     // 0..1    fraction of cells that carry grain (the "count")
  seed?: number
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function clamp(v: number) { return v < 0 ? 0 : v > 255 ? 255 : v }
function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v }
// Photoshop "overlay" blend per channel (0..255) — richer + more filmic than plain additive noise.
function overlay(b: number, s: number) {
  return b < 128 ? (2 * b * s) / 255 : 255 - (2 * (255 - b) * (255 - s)) / 255
}

// Film grain: monochrome noise generated on a coarse cell grid (size) and
// composited with an overlay blend. density controls how many cells get grain.
// Back-compat: passing a plain number behaves like { intensity }.
// Film-grain model: coarse monochrome noise upscaled + overlay-blended.
export function addGrain(ctx: any, w: number, h: number, opts: GrainOptions | number) {
  const o: GrainOptions = typeof opts === 'number' ? { intensity: opts } : (opts || {})
  const intensity = o.intensity ?? 22
  if (intensity <= 0) return
  const size = Math.max(1, Math.round(o.size ?? 2))
  const density = clamp01(o.density ?? 1)
  const a = clamp01((intensity / 100) * 0.5)           // overlay strength
  const rnd = mulberry32(((o.seed ?? 1234) >>> 0) + 9973)
  const nw = Math.ceil(w / size), nh = Math.ceil(h / size)
  const gray = new Uint8Array(nw * nh)
  const on = new Uint8Array(nw * nh)
  for (let i = 0; i < nw * nh; i++) { on[i] = rnd() < density ? 1 : 0; gray[i] = (rnd() * 255) | 0 }
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const row = ((y / size) | 0) * nw
    for (let x = 0; x < w; x++) {
      const ci = row + ((x / size) | 0)
      if (!on[ci]) continue
      const s = gray[ci]
      const idx = (y * w + x) << 2
      d[idx]     = clamp(d[idx]     * (1 - a) + overlay(d[idx],     s) * a)
      d[idx + 1] = clamp(d[idx + 1] * (1 - a) + overlay(d[idx + 1], s) * a)
      d[idx + 2] = clamp(d[idx + 2] * (1 - a) + overlay(d[idx + 2], s) * a)
    }
  }
  ctx.putImageData(img, 0, 0)
}

// Rounded-rectangle path helper (Path2D-free for max compatibility).
export function roundRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
