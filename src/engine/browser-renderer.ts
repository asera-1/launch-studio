import type { Renderer, RenderTarget, LoadedImage } from './render-target'

// Montserrat is bundled for an instant first paint; the others are pulled on demand
// from the @fontsource CDN at runtime (the browser fetches them directly).
const FONT_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource'
const FONT_WEIGHTS = [600, 700, 800] as const
const FONT_LOCAL: Record<string, Record<number, string>> = {
  Montserrat: { 600: '/fonts/Montserrat-600.ttf', 700: '/fonts/Montserrat-700.ttf', 800: '/fonts/Montserrat-800.ttf' },
}
const FONT_REMOTE: Record<string, string> = {
  Inter: 'inter', Poppins: 'poppins', Sora: 'sora', Archivo: 'archivo', Jakarta: 'plus-jakarta-sans',
}
const fontPromises: Record<string, Promise<void>> = {}

// Register every weight (600/700/800) of a family as FontFaces named `${family}${weight}`,
// which is exactly what the engine asks for when it builds `ctx.font`.
export function ensureFont(family: string): Promise<void> {
  if (fontPromises[family]) return fontPromises[family]
  fontPromises[family] = (async () => {
    let defs: [string, string][]
    if (FONT_LOCAL[family]) {
      defs = FONT_WEIGHTS.map((w) => [`${family}${w}`, FONT_LOCAL[family][w]])
    } else if (FONT_REMOTE[family]) {
      const id = FONT_REMOTE[family]
      defs = FONT_WEIGHTS.map((w) => [`${family}${w}`, `${FONT_CDN}/${id}@5/files/${id}-latin-${w}-normal.woff2`])
    } else { return }
    await Promise.all(defs.map(async ([fam, url]) => {
      try { const f = new FontFace(fam, `url(${url})`); await f.load(); (document as any).fonts.add(f) } catch {}
    }))
    try { await (document as any).fonts.ready } catch {}
  })()
  return fontPromises[family]
}

// Picker options for the UI: [value, label].
export const FONT_OPTIONS: [string, string][] = [
  ['Montserrat', 'Montserrat'], ['Inter', 'Inter'], ['Poppins', 'Poppins'],
  ['Sora', 'Sora'], ['Archivo', 'Archivo'], ['Jakarta', 'Plus Jakarta'],
]

export function initFonts(): Promise<void> { return ensureFont('Montserrat') }

function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  // Flatten to opaque 24-bit RGB (no alpha): App Store Connect and Google Play's
  // feature graphic reject PNGs that carry an alpha channel, even when fully opaque.
  const flat = document.createElement('canvas')
  flat.width = c.width; flat.height = c.height
  const g = flat.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, flat.width, flat.height)
  g.drawImage(c, 0, 0)
  return new Promise((res, rej) => flat.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'))
}

export function createBrowserRenderer(): Renderer {
  return {
    createTarget(width: number, height: number): RenderTarget {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d') as any
      return {
        width, height, ctx,
        encodePng: async () => new Uint8Array(await (await toBlob(canvas)).arrayBuffer()),
      }
    },
    async loadImage(src: string): Promise<LoadedImage> {
      const img = new Image()
      img.src = src
      await img.decode()
      return { width: img.naturalWidth, height: img.naturalHeight, image: img }
    },
  }
}

export function targetCanvas(t: RenderTarget): HTMLCanvasElement {
  return (t.ctx as CanvasRenderingContext2D).canvas
}
export function targetBlob(t: RenderTarget): Promise<Blob> {
  return toBlob(targetCanvas(t))
}
