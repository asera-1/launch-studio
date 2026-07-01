import type { Renderer, RenderTarget } from './render-target'
import type { FrameColor } from './device'
import type { Theme } from './types'
import { drawDeviceAndScreen } from './device'
import { drawBackground } from './background'
import { drawStatusBar } from './statusbar'
import { roundRectPath } from './imgproc'

export interface PHHeadLine { text: string; accent?: boolean }
export interface PHSpec {
  screenshot: string
  side?: 'left' | 'right'
  device?: 'phone' | 'safari'
  url?: string
  kicker?: string
  head: PHHeadLine[]
  sub?: string
  deviceColor?: FrameColor
  theme: Theme
}
const PH_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/
export const PH_TARGET = { id: 'producthunt-gallery', label: 'Product Hunt  1270x760', width: 1270, height: 760, folder: 'product-hunt' }

function fitFont(ctx: any, family: string, text: string, targetPx: number, maxW: number): number {
  let size = Math.round(targetPx)
  while (size > 16) { ctx.font = `${size}px ${family}`; if (ctx.measureText(text).width <= maxW) return size; size -= 2 }
  return 16
}

function drawText(ctx: any, W: number, H: number, spec: PHSpec, side: 'left' | 'right') {
  const fam = spec.theme.fontFamily
  // Append the always-bundled Montserrat of the SAME weight so text falls back to
  // Montserrat (not the browser default serif) when the CDN font is unavailable offline.
  const FAM = { k: `"${fam}700", "Montserrat700", sans-serif`, h: `"${fam}800", "Montserrat800", sans-serif`, s: `"${fam}600", "Montserrat600", sans-serif` }
  const tx = side === 'left' ? Math.round(W * 0.55) : Math.round(W * 0.07)
  const maxW = Math.round(W * 0.40)
  const grad = spec.theme.gradient
  type L = { kind: 'k' | 'h' | 'a' | 's'; text: string; size: number; w: number; fam: string }
  const lines: L[] = []
  const add = (kind: L['kind'], text: string, targetPx: number, fam: string) => {
    const size = fitFont(ctx, fam, text, targetPx, maxW)
    ctx.font = `${size}px ${fam}`
    lines.push({ kind, text, size, w: ctx.measureText(text).width, fam })
  }
  if (spec.kicker) add('k', spec.kicker, H * 0.030, FAM.k)
  for (const ln of spec.head) add(ln.accent ? 'a' : 'h', ln.text, H * 0.092, FAM.h)
  if (spec.sub) add('s', spec.sub, H * 0.034, FAM.s)
  const gap = (k: string) => (k === 'k' ? H * 0.020 : k === 's' ? H * 0.028 : H * 0.012)
  let total = 0
  lines.forEach((l, i) => { total += l.size; if (i > 0) total += gap(l.kind) })
  let y = Math.round(H / 2 - total / 2)
  const rtl = lines.some((l) => PH_RTL.test(l.text))
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (i > 0) y += gap(l.kind)
    ctx.font = `${l.size}px ${l.fam}`
    ctx.textAlign = rtl ? 'right' : 'left'
    ;(ctx as any).direction = rtl ? 'rtl' : 'ltr'
    const ax = rtl ? tx + maxW : tx
    if (l.kind === 'a') {
      const g0 = rtl ? tx + maxW - l.w : tx
      const lg = ctx.createLinearGradient(g0, 0, g0 + l.w, 0)
      lg.addColorStop(0, grad[0]); lg.addColorStop(1, grad[1])
      ctx.fillStyle = lg; ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = spec.theme.headlineColor
      ctx.globalAlpha = l.kind === 'h' ? 1 : l.kind === 'k' ? 0.9 : 0.72
    }
    ctx.fillText(l.text, ax, y)
    ctx.globalAlpha = 1
    y += l.size
  }
  ctx.textAlign = 'left'; (ctx as any).direction = 'ltr'
}

function drawTextTop(ctx: any, W: number, H: number, spec: PHSpec): number {
  const fam = spec.theme.fontFamily
  // Append the always-bundled Montserrat of the SAME weight so text falls back to
  // Montserrat (not the browser default serif) when the CDN font is unavailable offline.
  const FAM = { k: `"${fam}700", "Montserrat700", sans-serif`, h: `"${fam}800", "Montserrat800", sans-serif`, s: `"${fam}600", "Montserrat600", sans-serif` }
  const maxW = Math.round(W * 0.86)
  const cx = Math.round(W / 2)
  const grad = spec.theme.gradient
  type L = { kind: 'k' | 'h' | 'a' | 's'; text: string; size: number; w: number; fam: string }
  const lines: L[] = []
  const add = (kind: L['kind'], text: string, targetPx: number, fam: string) => {
    const size = fitFont(ctx, fam, text, targetPx, maxW)
    ctx.font = `${size}px ${fam}`
    lines.push({ kind, text, size, w: ctx.measureText(text).width, fam })
  }
  if (spec.kicker) add('k', spec.kicker, H * 0.030, FAM.k)
  for (const ln of spec.head) add(ln.accent ? 'a' : 'h', ln.text, H * 0.070, FAM.h)
  if (spec.sub) add('s', spec.sub, H * 0.030, FAM.s)
  const gap = (k: string) => (k === 'k' ? H * 0.014 : k === 's' ? H * 0.020 : H * 0.006)
  let y = Math.round(H * 0.05)
  const rtl = lines.some((l) => PH_RTL.test(l.text))
  ctx.textBaseline = 'top'; ctx.textAlign = 'center'; (ctx as any).direction = rtl ? 'rtl' : 'ltr'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (i > 0) y += gap(l.kind)
    ctx.font = `${l.size}px ${l.fam}`
    if (l.kind === 'a') {
      const lg = ctx.createLinearGradient(cx - l.w / 2, 0, cx + l.w / 2, 0)
      lg.addColorStop(0, grad[0]); lg.addColorStop(1, grad[1]); ctx.fillStyle = lg; ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = spec.theme.headlineColor
      ctx.globalAlpha = l.kind === 'h' ? 1 : l.kind === 'k' ? 0.9 : 0.72
    }
    ctx.fillText(l.text, cx, y); ctx.globalAlpha = 1
    y += l.size
  }
  ctx.textAlign = 'left'; (ctx as any).direction = 'ltr'
  return y
}

function bottomRoundedPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.closePath()
}

function drawLock(ctx: any, x: number, cy: number, s: number, color: string): number {
  const bw = Math.round(s * 0.74), bh = Math.round(s * 0.56)
  const bx = x, by = Math.round(cy - bh * 0.30)
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.4, s * 0.10); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(bx + bw / 2, by, bw * 0.30, Math.PI, 0); ctx.stroke()
  roundRectPath(ctx, bx, by, bw, bh, Math.round(bw * 0.22)); ctx.fillStyle = color; ctx.fill()
  return bw
}

// macOS Safari window. contentH is passed so the window wraps the screenshot at its
// NATIVE aspect ratio (no crop, no letterbox gaps, any upload size).
function drawSafari(ctx: any, shot: any, cx: number, topY: number, winW: number, contentH: number, url?: string) {
  const R = Math.max(8, Math.round(winW * 0.014))
  const toolbarH = Math.max(30, Math.round(winW * 0.062))
  const winH = toolbarH + contentH
  const x = Math.round(cx - winW / 2), y = topY
  const ty = y + Math.round(toolbarH / 2)
  const gray = '#9b9ba1'
  ctx.save()
  ctx.shadowColor = 'rgba(6,14,35,0.34)'; ctx.shadowBlur = Math.round(winW * 0.045); ctx.shadowOffsetY = Math.round(winW * 0.02)
  roundRectPath(ctx, x, y, winW, winH, R); ctx.fillStyle = '#ffffff'; ctx.fill()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, x, y, winW, winH, R); ctx.clip()
  const tb = ctx.createLinearGradient(0, y, 0, y + toolbarH)
  tb.addColorStop(0, '#f8f8f9'); tb.addColorStop(1, '#ececee')
  ctx.fillStyle = tb; ctx.fillRect(x, y, winW, toolbarH)
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = Math.max(1, Math.round(winW * 0.0016))
  ctx.beginPath(); ctx.moveTo(x, y + toolbarH + 0.5); ctx.lineTo(x + winW, y + toolbarH + 0.5); ctx.stroke()
  const r = Math.max(4, Math.round(winW * 0.0082))
  let lx = x + Math.round(winW * 0.024) + r
  for (const col of ['#ff5f57', '#febc2e', '#28c840']) {
    ctx.beginPath(); ctx.arc(lx, ty, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1; ctx.stroke()
    lx += r * 2 + Math.round(winW * 0.011)
  }
  ctx.strokeStyle = gray; ctx.lineWidth = Math.max(2, Math.round(winW * 0.0032)); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const ch = Math.round(winW * 0.010)
  const bx = lx + Math.round(winW * 0.016)
  ctx.beginPath(); ctx.moveTo(bx + ch, ty - ch); ctx.lineTo(bx, ty); ctx.lineTo(bx + ch, ty + ch); ctx.stroke()
  const fx = bx + Math.round(winW * 0.030)
  ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.moveTo(fx, ty - ch); ctx.lineTo(fx + ch, ty); ctx.lineTo(fx, ty + ch); ctx.stroke(); ctx.globalAlpha = 1
  const pillW = Math.round(winW * 0.46), pillH = Math.max(16, Math.round(toolbarH * 0.56))
  const pillX = Math.round(cx - pillW / 2), pillY = Math.round(ty - pillH / 2)
  roundRectPath(ctx, pillX, pillY, pillW, pillH, Math.round(pillH * 0.30)); ctx.fillStyle = '#e4e4e7'; ctx.fill()
  const fs = Math.max(11, Math.round(pillH * 0.42))
  ctx.font = `${fs}px Montserrat600`
  const domain = (url && url.trim()) ? url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') : 'yourapp.com'
  const tw = ctx.measureText(domain).width
  const lockW = Math.round(fs * 0.74)
  const grpW = lockW + Math.round(fs * 0.42) + tw
  const gx = Math.round(cx - grpW / 2)
  drawLock(ctx, gx, ty, fs, '#8a8a90')
  ctx.fillStyle = '#5f5f66'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(domain, gx + lockW + Math.round(fs * 0.42), ty + 1)
  ctx.strokeStyle = gray; ctx.fillStyle = gray; ctx.lineWidth = Math.max(2, Math.round(winW * 0.0030)); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const isz = Math.round(winW * 0.011)
  let rx = x + winW - Math.round(winW * 0.030)
  roundRectPath(ctx, rx - isz, ty - isz, isz * 2, isz * 2, Math.round(isz * 0.4)); ctx.stroke()
  rx -= Math.round(winW * 0.040)
  ctx.beginPath(); ctx.moveTo(rx - isz, ty); ctx.lineTo(rx + isz, ty); ctx.moveTo(rx, ty - isz); ctx.lineTo(rx, ty + isz); ctx.stroke()
  rx -= Math.round(winW * 0.040)
  ctx.beginPath()
  ctx.moveTo(rx - isz, ty - isz * 0.1); ctx.lineTo(rx - isz, ty + isz); ctx.lineTo(rx + isz, ty + isz); ctx.lineTo(rx + isz, ty - isz * 0.1); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(rx, ty - isz * 1.1); ctx.lineTo(rx, ty + isz * 0.4); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(rx - isz * 0.5, ty - isz * 0.55); ctx.lineTo(rx, ty - isz * 1.15); ctx.lineTo(rx + isz * 0.5, ty - isz * 0.55); ctx.stroke()
  const cyTop = y + toolbarH
  ctx.save()
  bottomRoundedPath(ctx, x, cyTop, winW, contentH, R); ctx.clip()
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, cyTop, winW, contentH)
  ctx.imageSmoothingEnabled = true; (ctx as any).imageSmoothingQuality = 'high'
  ctx.drawImage(shot.image, x, cyTop, winW, contentH)
  ctx.restore()
  roundRectPath(ctx, x, y, winW, winH, R); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = Math.max(1, Math.round(winW * 0.0016)); ctx.stroke()
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

export async function renderProductHunt(renderer: Renderer, spec: PHSpec, scale = 1.5): Promise<RenderTarget> {
  const W = Math.round(1270 * scale), H = Math.round(760 * scale)
  const t = renderer.createTarget(W, H)
  const ctx = t.ctx
  drawBackground(t, { width: W, height: H } as any, spec.theme)
  const shot = await renderer.loadImage(spec.screenshot)

  if ((spec.device ?? 'phone') === 'safari') {
    const headBottom = drawTextTop(ctx, W, H, spec)
    const padX = Math.round(W * 0.09)
    const topY = Math.round(headBottom + H * 0.04)
    const availH = H - topY - Math.round(H * 0.05)
    const availW = W - 2 * padX
    const shotAsp = Math.min(4, Math.max(0.35, shot.width / shot.height))
    const tbF = 0.062
    const winW = Math.max(200, Math.min(availW, Math.round(availH / (tbF + 1 / shotAsp))))
    const toolbarH = Math.max(30, Math.round(winW * 0.062))
    const contentH = Math.round(winW / shotAsp)
    const winTotalH = toolbarH + contentH
    const cx = Math.round(W / 2)
    const topY2 = topY + Math.max(0, Math.round((availH - winTotalH) / 2))
    const gcy = topY2 + Math.round(winTotalH * 0.42)
    const glow = ctx.createRadialGradient(cx, gcy, 0, cx, gcy, Math.round(Math.min(W, H) * 0.7))
    glow.addColorStop(0, 'rgba(255,255,255,0.12)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    drawSafari(ctx, shot, cx, topY2, winW, contentH, spec.url)
    return t
  }

  const side = spec.side ?? 'left'
  const screenH = Math.round(H * 0.84)
  const sw = Math.round(screenH * 0.462), sh = screenH // fixed portrait phone — never stretches to the upload
  const cx = side === 'left' ? Math.round(W * 0.27) : Math.round(W * 0.73)
  const cy = Math.round(H * 0.5)
  const sx = Math.round(cx - sw / 2), sy = Math.round(cy - sh / 2)
  const glow = ctx.createRadialGradient(cx, Math.round(H * 0.42), 0, cx, Math.round(H * 0.42), Math.round(Math.min(W, H) * 0.62))
  glow.addColorStop(0, 'rgba(255,255,255,0.12)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  const bezel = Math.max(2, Math.round(sw * 0.030)), cr = Math.round(sw * 0.12)
  const faux: any = { device: { screen: { x: sx, y: sy, w: sw, h: sh }, cornerRadius: cr, bezel, island: { w: Math.round(sw * 0.30), h: Math.round(sw * 0.085), top: Math.round(sw * 0.035) }, statusScale: sw / 943 } }
  drawDeviceAndScreen(t, faux, shot, spec.deviceColor ?? 'titanium', 'cover')
  drawStatusBar(t, faux)
  drawText(ctx, W, H, spec, side)
  return t
}
