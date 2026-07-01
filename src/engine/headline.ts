import type { RenderTarget } from './render-target'
import type { StoreTarget, Theme } from './types'

function lineWidth(ctx: any, text: string, font: string, size: number, track: number): number {
  ctx.font = `${size}px ${font}`
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + track
  return text.length ? w - track : 0
}

function fitSize(ctx: any, text: string, font: string, capPx: number, maxW: number, trackRatio: number): number {
  let size = Math.round(capPx / 0.7)
  while (size > 10) {
    if (lineWidth(ctx, text, font, size, size * trackRatio) <= maxW) return size
    size -= 2
  }
  return 10
}

function drawTracked(ctx: any, text: string, font: string, size: number, track: number, cx: number, baseline: number, fill: any) {
  const total = lineWidth(ctx, text, font, size, track)
  let x = cx - total / 2
  ctx.font = `${size}px ${font}`
  ctx.fillStyle = fill
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const ch of text) {
    ctx.fillText(ch, x, baseline)
    x += ctx.measureText(ch).width + track
  }
}

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/

// Right-to-left (e.g. Arabic) needs a single shaped fillText, not per-character tracking.
function drawRtlLine(ctx: any, text: string, font: string, capPx: number, maxW: number, cx: number, baseline: number, fill: any) {
  if (!text) return
  let size = Math.round(capPx / 0.7)
  while (size > 10) { ctx.font = `${size}px ${font}`; if (ctx.measureText(text).width <= maxW) break; size -= 2 }
  ctx.font = `${size}px ${font}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'rtl'
  if (Array.isArray(fill)) {
    const w = ctx.measureText(text).width
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0)
    g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]); ctx.fillStyle = g
  } else ctx.fillStyle = fill
  ctx.fillText(text, cx, baseline)
  ctx.direction = 'ltr'; ctx.textAlign = 'left'
}

export function drawHeadline(t: RenderTarget, store: StoreTarget, theme: Theme, line1: string, line2: string) {
  const { ctx } = t
  const a = store.headline
  const wt1 = theme.weightLine1 ?? 600
  const wt2 = theme.weightLine2 ?? 700
  // Append the always-bundled Montserrat of the SAME weight so text falls back to
  // Montserrat (not the browser default serif) when the CDN font is unavailable offline.
  const fam1 = `"${theme.fontFamily}${wt1}", "Montserrat${wt1}", sans-serif`
  const fam2 = `"${theme.fontFamily}${wt2}", "Montserrat${wt2}", sans-serif`
  const tr1 = 0.045, tr2 = 0.012

  if (RTL_RE.test(line1) || RTL_RE.test(line2)) {
    drawRtlLine(ctx, line1, fam1, a.cap1, a.maxWidth, a.cx, a.baseline1, theme.headlineColor)
    drawRtlLine(ctx, line2, fam2, a.cap2, a.maxWidth, a.cx, a.baseline2, theme.gradient)
    return
  }

  const s1 = fitSize(ctx, line1, fam1, a.cap1, a.maxWidth, tr1)
  drawTracked(ctx, line1, fam1, s1, s1 * tr1, a.cx, a.baseline1, theme.headlineColor)

  const s2 = fitSize(ctx, line2, fam2, a.cap2, a.maxWidth, tr2)
  const w2 = lineWidth(ctx, line2, fam2, s2, s2 * tr2)
  const grad = ctx.createLinearGradient(a.cx - w2 / 2, 0, a.cx + w2 / 2, 0)
  grad.addColorStop(0, theme.gradient[0])
  grad.addColorStop(1, theme.gradient[1])
  drawTracked(ctx, line2, fam2, s2, s2 * tr2, a.cx, a.baseline2, grad)
}
