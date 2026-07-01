"use client"
import * as React from "react"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import JSZip from "jszip"
import { toast } from "sonner"
import { renderSlide } from "@/engine/compose"
import { allTargets } from "@/engine/targets"
import type { Slide, StoreTarget, Theme, GradientStyle } from "@/engine/types"
import { DeterministicDirector, OpenAIDirector, localizeHeadlines } from "@/engine/director"
import { renderTemplateSlide } from "@/engine/template"
import { buildContactSheet } from "@/engine/contactsheet"
import type { RenderTarget } from "@/engine/render-target"
import { createBrowserRenderer, initFonts, ensureFont, FONT_OPTIONS, targetBlob, targetCanvas } from "@/engine/browser-renderer"
import { idbSet, idbGet, idbDelete, idbClear } from "@/lib/idb"
import { PRESETS, PRESET_BY_KEY } from "@/engine/themes"
import { themeFromColors, paletteFromImage, contrastRatio, darken } from "@/engine/color"
import { renderProductHunt, type PHSpec } from "@/engine/producthunt"
import { AppStoreIcon, GooglePlayIcon, ProductHuntIcon, PlatformIcon } from "@/components/store-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

interface UISlide { id: string; name: string; url: string; line1: string; line2: string }
interface PHCopy { kicker: string; line1: string; line2: string; sub: string; side: "left" | "right"; device?: "phone" | "safari"; url?: string }

const slug = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "slide"
const toEngine = (s: UISlide): Slide => ({ id: s.id, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 } })
function toDataUrl(url: string): Promise<string> {
  return fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((res, rej) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b)
  }))
}
function download(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}
const notify = (msg: string, error = false) => (error ? toast.error(msg) : toast.success(msg))
const OFFLINE_OPTIONS = [
  { line1: "LEARN FASTER", line2: "EVERY DAY" },
  { line1: "BUILT FOR", line2: "REAL PROGRESS" },
  { line1: "YOUR WAY", line2: "TO FLUENCY" },
]
const phDefault = (): PHCopy => ({ kicker: "", line1: "YOUR HEADLINE", line2: "GOES HERE", sub: "", side: "left", device: "phone", url: "" })
const LANGS: [string, string][] = [["de", "German"], ["es", "Spanish"], ["fr", "French"], ["it", "Italian"], ["pt", "Portuguese"], ["ja", "Japanese"], ["ko", "Korean"], ["ar", "Arabic"], ["zh", "Chinese"], ["hi", "Hindi"]]

function Pill({ active, ...props }: React.ComponentProps<typeof Button> & { active: boolean }) {
  return <Button type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} {...props} />
}

function CopyField({ label, value, onChange, limit, placeholder }: { label: string; value: string; onChange: (e: any) => void; limit: number; placeholder?: string }) {
  const over = value.length > limit
  const id = React.useId()
  return (
    <div className="field">
      <label className="lbl-row" htmlFor={id}><span>{label}</span><span className={"count" + (over ? " over" : "")}>{value.length}/{limit}</span></label>
      <Input id={id} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

const uploadKey = { role: "button" as const, tabIndex: 0, onKeyDown: (e: React.KeyboardEvent<HTMLLabelElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.click() } } }

export function Studio() {
  const renderer = useMemo(() => createBrowserRenderer(), [])
  const [mode, setMode] = useState<"store" | "ph">("store")
  const [fontsReady, setFontsReady] = useState(false)
  const [slides, setSlides] = useState<UISlide[]>([])
  const [themeKey, setThemeKey] = useState("brand-blue")
  const [customTheme, setCustomTheme] = useState<Theme | null>(null)
  const [brandColor, setBrandColor] = useState("#5CA8FF")
  const [deviceColor, setDeviceColor] = useState<"titanium" | "black" | "silver">("titanium")
  const [gradientStyle, setGradientStyle] = useState<GradientStyle>("diagonal")
  const [fontFamily, setFontFamily] = useState("Montserrat")
  const [noiseIntensity, setNoiseIntensity] = useState(22)
  const [noiseSize, setNoiseSize] = useState(2)
  const [noiseDensity, setNoiseDensity] = useState(1)
  const [options, setOptions] = useState<{ line1: string; line2: string }[]>([])
  const [enabled, setEnabled] = useState<string[]>(allTargets.map((t) => t.id))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStore, setActiveStore] = useState<string>(allTargets[0].id)
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [templateMode, setTemplateMode] = useState(false)
  const [layout, setLayout] = useState<"headline-top" | "headline-bottom">("headline-top")
  const [safeArea, setSafeArea] = useState(false)
  const [rememberKey, setRememberKey] = useState<boolean>(() => { try { return !!localStorage.getItem("launch-studio.aiKey") } catch { return false } })
  const [aiKey, setAiKey] = useState<string>(() => { try { return localStorage.getItem("launch-studio.aiKey") || sessionStorage.getItem("launch-studio.aiKey") || "" } catch { return "" } })
  const [brief, setBrief] = useState({ name: "", audience: "", benefit: "", tone: "" })
  const briefProfile = () => ({ name: brief.name.trim() || "your app", audience: brief.audience.trim() || undefined, benefit: brief.benefit.trim() || undefined, tone: brief.tone.trim() || undefined })
  const aiModel = "gpt-4o-mini"
  const [variants, setVariants] = useState<string[]>([])
  const [locales, setLocales] = useState("")
  const [busy, setBusy] = useState("")
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [phMap, setPhMap] = useState<Record<string, PHCopy>>({})
  const [showExport, setShowExport] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [saved, setSaved] = useState<"" | "saving" | "saved">("")
  const [experiment, setExperiment] = useState(false)
  const [uiTheme, setUiTheme] = useState<"dark" | "light">("dark")
  useEffect(() => { try { const t = localStorage.getItem("launch-studio.theme"); if (t === "light" || t === "dark") setUiTheme(t) } catch {} }, [])
  useEffect(() => { document.documentElement.dataset.theme = uiTheme }, [uiTheme])
  const toggleTheme = () => setUiTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem("launch-studio.theme", n) } catch {} ; return n })
  const previewRef = useRef<HTMLCanvasElement>(null)
  const tokenRef = useRef(0)
  const showingExamplesRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Apply live "effects" (gradient style, font, film grain, layout, frame finish) onto any base theme.
  const applyFx = useCallback((base: Theme): Theme => {
    const noise = { grain: noiseIntensity, grainSize: noiseSize, grainDensity: noiseDensity }
    const background = base.background.kind === "synthetic"
      ? { ...base.background, style: gradientStyle, ...noise }
      : { ...base.background, ...noise }
    return { ...base, background, layout, deviceColor, fontFamily }
  }, [gradientStyle, noiseIntensity, noiseSize, noiseDensity, layout, deviceColor, fontFamily])

  const theme: Theme = useMemo(() => {
    const t = themeKey === "custom" && customTheme ? customTheme : (PRESET_BY_KEY[themeKey]?.theme ?? PRESET_BY_KEY["brand-blue"].theme)
    return applyFx(t)
  }, [themeKey, customTheme, applyFx])
  const active = slides.find((s) => s.id === activeId) || null
  const store = allTargets.find((t) => t.id === activeStore)!
  const activeIdx = slides.findIndex((s) => s.id === activeId)
  const gotoSlide = (i: number) => { if (i >= 0 && i < slides.length) setActiveId(slides[i].id) }

  const phOf = (id: string): PHCopy => phMap[id] ?? phDefault()
  const setPh = (id: string, patch: Partial<PHCopy>) => setPhMap((m) => ({ ...m, [id]: { ...phOf(id), ...patch } }))
  const phSpec = (s: UISlide): PHSpec => {
    const p = phOf(s.id)
    return { screenshot: s.url, side: p.side, device: p.device ?? "phone", url: p.url || undefined, kicker: p.kicker || undefined, deviceColor, theme,
      head: [...(p.line1 ? [{ text: p.line1 }] : []), ...(p.line2 ? [{ text: p.line2, accent: true }] : [])],
      sub: p.sub || undefined }
  }

  const renderOne = (s: UISlide, st: StoreTarget) =>
    templateMode && frameUrl
      ? renderTemplateSlide(renderer, { frame: frameUrl, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 }, theme, recolor: theme.background.kind === "synthetic" ? { from: theme.background.from, to: theme.background.to } : undefined })
      : renderSlide(renderer, { theme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)

  useEffect(() => { initFonts().then(() => setFontsReady(true)) }, [])
  useEffect(() => { try { if (rememberKey) { localStorage.setItem("launch-studio.aiKey", aiKey) } else { localStorage.removeItem("launch-studio.aiKey"); if (aiKey) sessionStorage.setItem("launch-studio.aiKey", aiKey); else sessionStorage.removeItem("launch-studio.aiKey") } } catch {} }, [aiKey, rememberKey])

  // restore the last project (autosave) once, on first load
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem("launch-studio.project")
        if (raw) {
          const d = JSON.parse(raw)
          if (d && Array.isArray(d.slides) && d.slides.length) {
            const restored: UISlide[] = []
            for (const s of d.slides) {
              let url: string | undefined = s.url
              if (s.kind === "idb") url = await idbGet(s.id)
              if (!url) continue
              restored.push({ id: s.id, name: s.name || "screen", line1: s.line1 || "", line2: s.line2 || "", url })
            }
            if (restored.length) {
              setSlides(restored)
              setActiveId(restored.some((r) => r.id === d.activeId) ? d.activeId : restored[0].id)
              if (d.mode === "store" || d.mode === "ph") setMode(d.mode)
              if (d.themeKey) setThemeKey(d.themeKey)
              if (d.customTheme) setCustomTheme(d.customTheme)
              if (d.deviceColor) setDeviceColor(d.deviceColor)
              if (d.gradientStyle) setGradientStyle(d.gradientStyle)
              if (d.fontFamily) setFontFamily(d.fontFamily)
              if (typeof d.noiseIntensity === "number") setNoiseIntensity(d.noiseIntensity)
              if (typeof d.noiseSize === "number") setNoiseSize(d.noiseSize)
              if (typeof d.noiseDensity === "number") setNoiseDensity(d.noiseDensity)
              if (d.layout) setLayout(d.layout)
              if (Array.isArray(d.enabled)) setEnabled(d.enabled)
              if (Array.isArray(d.variants)) setVariants(d.variants)
              if (typeof d.locales === "string") setLocales(d.locales)
              if (d.phMap) setPhMap(d.phMap)
              if (d.brief && typeof d.brief === "object") setBrief({ name: "", audience: "", benefit: "", tone: "", ...d.brief })
            }
          }
        }
      } catch {}
      setHydrated(true)
    })()
  }, [])

  // autosave (debounced) after hydration
  useEffect(() => {
    if (!hydrated) return
    setSaved("saving")
    const t = window.setTimeout(() => {
      try {
        const data = {
          mode, themeKey, customTheme, deviceColor, gradientStyle, fontFamily,
          noiseIntensity, noiseSize, noiseDensity, layout, enabled, variants, locales, activeId, phMap, brief,
          slides: slides.map((s) => { const ext = s.url.startsWith("blob:") || s.url.startsWith("data:"); return { id: s.id, name: s.name, line1: s.line1, line2: s.line2, kind: ext ? "idb" : "url", url: ext ? undefined : s.url } }),
        }
        localStorage.setItem("launch-studio.project", JSON.stringify(data))
        setSaved("saved")
      } catch { setSaved("") }
    }, 500)
    return () => window.clearTimeout(t)
  }, [hydrated, mode, themeKey, customTheme, deviceColor, gradientStyle, fontFamily, noiseIntensity, noiseSize, noiseDensity, layout, enabled, variants, locales, activeId, phMap, brief, slides])

  const addFiles = useCallback((files: FileList | File[]) => {
    const OK = ["image/png", "image/jpeg", "image/webp"]; const MAX = 15 * 1024 * 1024
    const all = Array.from(files)
    const arr = all.filter((f) => OK.includes(f.type) && f.size <= MAX)
    const skipped = all.length - arr.length
    if (skipped) toast.error(`${skipped} file${skipped === 1 ? "" : "s"} skipped — use PNG, JPG or WebP under 15 MB.`)
    const next: UISlide[] = arr.map((f, i) => ({ id: `${slug(f.name)}-${(Date.now() + i).toString(36).slice(-4)}`, name: f.name, url: URL.createObjectURL(f), line1: "", line2: "" }))
    if (!next.length) return
    next.forEach((s, i) => { const fr = new FileReader(); fr.onload = () => { idbSet(s.id, String(fr.result)) }; fr.readAsDataURL(arr[i]) })
    setSlides((p) => (showingExamplesRef.current ? next : [...p, ...next]))
    showingExamplesRef.current = false
    setActiveId(next[0].id)
  }, [])

  // Paste a screenshot straight from the clipboard (⌘V / Ctrl+V) — no need to save it first.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      const items = e.clipboardData?.items
      if (!items) return
      const imgs: File[] = []
      for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) imgs.push(f) } }
      if (imgs.length) { e.preventDefault(); addFiles(imgs); toast.success(imgs.length === 1 ? "Screenshot pasted" : `${imgs.length} screenshots pasted`) }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [addFiles])

  // Close the export drawer with Escape.
  useEffect(() => {
    if (!showExport) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowExport(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showExport])

  async function loadExamples() {
    slides.forEach((s) => { if (s.url.startsWith("blob:")) { try { URL.revokeObjectURL(s.url) } catch {} } })
    const ex: UISlide[] = [
      { id: "home", name: "home.png", url: "/examples/home.png", line1: "YOUR NEXT LESSON", line2: "READY EVERY DAY" },
      { id: "vocab", name: "saved-vocab.png", url: "/examples/vocab.png", line1: "BEAT THE", line2: "FORGETTING CURVE" },
    ]
    setSlides(ex); setActiveId("home"); showingExamplesRef.current = true
    setPhMap({
      home: { kicker: "", line1: "SPEAK FROM", line2: "DAY ONE", sub: "Real-time AI conversations designed for fluency", side: "left" },
      vocab: { kicker: "", line1: "BEAT THE", line2: "FORGETTING CURVE", sub: "Spaced repetition that actually sticks", side: "right" },
    })
  }
  // first run shows onboarding; the demo loads only when the user clicks "Load demo project"

  // live preview (store or product hunt)
  useEffect(() => {
    if (!fontsReady || !active || !previewRef.current) return
    const token = ++tokenRef.current
    const spinTimer = window.setTimeout(() => { if (token === tokenRef.current) setPreviewBusy(true) }, 180)
    ;(async () => {
      await ensureFont(theme.fontFamily)
      if (token !== tokenRef.current) return
      const target = mode === "ph" ? await renderProductHunt(renderer, phSpec(active)) : await renderOne(active, store)
      if (token !== tokenRef.current) return
      const src = targetCanvas(target); const dst = previewRef.current!
      dst.width = src.width; dst.height = src.height
      const g = dst.getContext("2d")!; g.drawImage(src, 0, 0)
      if (mode === "store" && safeArea && !store.featureGraphic) {
        g.save(); g.strokeStyle = "rgba(255,90,90,0.7)"; g.setLineDash([14, 10]); g.lineWidth = Math.max(2, dst.width * 0.004)
        const mx = dst.width * 0.05, my = dst.height * 0.04
        g.strokeRect(mx, my, dst.width - 2 * mx, dst.height - 2 * my); g.restore()
      }
    })().catch(console.error).finally(() => { window.clearTimeout(spinTimer); if (token === tokenRef.current) setPreviewBusy(false) })
  }, [mode, fontsReady, active?.id, active?.line1, active?.line2, activeStore, templateMode, frameUrl, safeArea, renderer, store, theme, phMap, deviceColor])

  function updateActive(patch: Partial<UISlide>) { if (active) setSlides((p) => p.map((s) => (s.id === active.id ? { ...s, ...patch } : s))) }
  function removeSlide(id: string) {
    setSlides((p) => {
      const gone = p.find((s) => s.id === id)
      if (gone && gone.url.startsWith("blob:")) { try { URL.revokeObjectURL(gone.url) } catch {} }
      const next = p.filter((s) => s.id !== id); if (id === activeId) setActiveId(next[0]?.id ?? null); return next
    })
    idbDelete(id)
    showingExamplesRef.current = false
  }
  function moveSlide(from: number | null, to: number) {
    if (from === null || from === to || to < 0 || to >= slides.length) return
    setSlides((p) => { const next = p.slice(); const [m] = next.splice(from, 1); next.splice(to, 0, m); return next })
    showingExamplesRef.current = false
  }
  function setCustom(t: Theme) { setCustomTheme(t); setThemeKey("custom") }
  async function matchScreenshot() {
    if (!active) return
    try { const pal = await paletteFromImage(active.url); setCustom(themeFromColors(pal[0], pal[1] ?? darken(pal[0], 0.42))); notify("Theme matched to your screenshot") }
    catch { notify("Could not read colors from that image", true) }
  }
  function applyCopy(res: { slides: { screenshotId: string; headline: { line1: string; line2: string } }[] }) {
    setSlides((p) => p.map((s) => { const c = res.slides.find((x) => x.screenshotId === s.id); return c ? { ...s, line1: c.headline.line1, line2: c.headline.line2 } : s }))
  }
  async function autoHeadlines() {
    if (!slides.length) return
    const useAI = !!aiKey.trim()
    setBusy(useAI ? "AI is reading your screens…" : "Writing headlines…")
    const stores: StoreTarget[] = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
    const brandVoice = { tone: "direct" as const, casing: "upper" as const, banned: [",", "—"] }
    try {
      const screenshots = useAI
        ? await Promise.all(slides.map(async (s) => ({ id: s.id, image: await toDataUrl(s.url), label: s.name })))
        : slides.map((s) => ({ id: s.id, image: s.url, label: s.name }))
      const dir = useAI ? new OpenAIDirector({ apiKey: aiKey.trim(), model: aiModel }) : new DeterministicDirector()
      applyCopy(await dir.generate({ screenshots, appProfile: briefProfile(), brandVoice, stores }))
    } catch (e: any) {
      notify("AI generation failed: " + (e?.message || e) + " — using offline templates instead.", true)
      try { applyCopy(await new DeterministicDirector().generate({ screenshots: slides.map((s) => ({ id: s.id, image: s.url, label: s.name })), appProfile: briefProfile(), brandVoice, stores })) } catch {}
    } finally { setBusy("") }
  }
  async function genOptions() {
    if (!active) return
    setBusy("Writing options…")
    const brandVoice = { tone: "direct" as const, casing: "upper" as const, banned: [",", "—"] }
    try {
      if (aiKey.trim()) {
        const dir = new OpenAIDirector({ apiKey: aiKey.trim(), model: aiModel }); const img = await toDataUrl(active.url)
        const opts = await dir.options({ id: active.id, image: img, label: active.name }, brandVoice.banned, "your app", 3)
        setOptions(opts.filter((o) => o.line1 || o.line2)); if (!opts.length) notify("No options returned", true)
      } else {
        const stores = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
        const det = await new DeterministicDirector().generate({ screenshots: [{ id: active.id, image: active.url, label: active.name }], appProfile: briefProfile(), brandVoice, stores })
        setOptions([det.slides[0]?.headline, ...OFFLINE_OPTIONS].filter(Boolean).slice(0, 3) as { line1: string; line2: string }[])
      }
    } catch (e: any) { notify("Options failed: " + (e?.message || e), true) } finally { setBusy("") }
  }
  async function downloadActive() { if (!active) return; await ensureFont(theme.fontFamily); const t = await renderOne(active, store); download(await targetBlob(t), `${active.id}-${store.id}.png`) }
  async function downloadActivePH() { if (!active) return; await ensureFont(theme.fontFamily); const t = await renderProductHunt(renderer, phSpec(active), 2.5); download(await targetBlob(t), `${active.id}-producthunt.png`) }

  async function exportZip() {
    if (!slides.length || !enabled.length) return
    await ensureFont(theme.fontFamily)
    const locs = locales.split(",").map((x) => x.trim()).filter(Boolean)
    const useTemplate = templateMode && !!frameUrl
    const useLocale = !!locs.length && !!aiKey.trim()
    const variantKeys = !useTemplate && !useLocale && variants.length ? variants : null
    if (locs.length && !aiKey.trim()) notify("Languages need an AI key — exporting without translation.", true)
    if (useLocale && variants.length) notify("Languages take priority; A/B variants skipped this export.")
    const total = useTemplate ? slides.length : useLocale ? locs.length * enabled.length * slides.length : (variantKeys ? variantKeys.length : 1) * enabled.length * slides.length
    let done = 0; const tick = () => setProgress({ done: ++done, total })
    setProgress({ done: 0, total }); setBusy(useLocale ? "Translating + rendering…" : "Rendering kit…")
    const zip = new JSZip(); const sheetItems: { label: string; canvas: HTMLCanvasElement }[] = []
    const thumb = (t: RenderTarget) => { const src = targetCanvas(t); const s = Math.min(240 / src.width, 500 / src.height, 1); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s)); c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height); return c }
    const manifest: any = { generatedAt: new Date().toISOString(), files: [] as any[] }
    try {
      if (useTemplate) {
        for (const s of slides) { const target = await renderOne(s, store); zip.file(`template/${s.id}.png`, await targetBlob(target)); sheetItems.push({ label: s.id, canvas: thumb(target) }); manifest.files.push({ store: "template", slide: s.id, file: `template/${s.id}.png` }); tick() }
      } else if (useLocale) {
        const tr = await localizeHeadlines(slides.map((s) => ({ id: s.id, line1: s.line1, line2: s.line2 })), locs, { apiKey: aiKey.trim(), model: aiModel })
        for (const loc of locs) for (const id of enabled) {
          const st = allTargets.find((t) => t.id === id)!
          for (const s of slides) {
            const h = tr[loc]?.[s.id] ?? { line1: s.line1, line2: s.line2 }; const eng = { id: s.id, screenshot: s.url, headline: h }
            const target = await renderSlide(renderer, { theme, stores: [st], slides: [eng] }, eng, st)
            zip.file(`${loc}/${st.folder}/${s.id}.png`, await targetBlob(target)); sheetItems.push({ label: `${loc} · ${st.label} ${s.id}`, canvas: thumb(target) }); manifest.files.push({ locale: loc, store: id, slide: s.id, file: `${loc}/${st.folder}/${s.id}.png` }); tick()
          }
        }
      } else {
        const keys = variantKeys ?? [themeKey]
        for (const vk of keys) {
          const base = PRESET_BY_KEY[vk] ? PRESET_BY_KEY[vk].theme : theme
          const vtheme: Theme = applyFx(base)
          const prefix = variantKeys ? `variant-${vk}/` : ""
          for (const id of enabled) {
            const st = allTargets.find((t) => t.id === id)!
            for (const s of slides) {
              const target = await renderSlide(renderer, { theme: vtheme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)
              zip.file(`${prefix}${st.folder}/${s.id}.png`, await targetBlob(target)); sheetItems.push({ label: `${variantKeys ? vk + " · " : ""}${st.label} ${s.id}`, canvas: thumb(target) }); manifest.files.push({ variant: vk, store: id, slide: s.id, file: `${prefix}${st.folder}/${s.id}.png` }); tick()
            }
          }
        }
      }
      if (sheetItems.length) zip.file("_overview.png", await targetBlob(buildContactSheet(renderer, sheetItems)))
      zip.file("manifest.json", JSON.stringify(manifest, null, 2))
      download(await zip.generateAsync({ type: "blob" }), "launch-studio-kit.zip")
      notify(`Exported ${manifest.files.length} image${manifest.files.length === 1 ? "" : "s"} → launch-studio-kit.zip`)
    } catch (e: any) { notify("Export failed: " + (e?.message || e), true) } finally { setBusy(""); setProgress(null) }
  }

  async function exportPH() {
    if (!slides.length) return
    await ensureFont(theme.fontFamily)
    setProgress({ done: 0, total: slides.length }); setBusy("Rendering Product Hunt…")
    const zip = new JSZip(); let done = 0
    try {
      for (const s of slides) { const t = await renderProductHunt(renderer, phSpec(s), 2.5); zip.file(`product-hunt/${s.id}.png`, await targetBlob(t)); setProgress({ done: ++done, total: slides.length }) }
      download(await zip.generateAsync({ type: "blob" }), "launch-studio-producthunt.zip")
      notify(`Exported ${slides.length} Product Hunt image${slides.length === 1 ? "" : "s"}`)
    } catch (e: any) { notify("Export failed: " + (e?.message || e), true) } finally { setBusy(""); setProgress(null) }
  }

  const swatchList = customTheme ? [...PRESETS, { key: "custom", label: "Custom", theme: customTheme }] : PRESETS
  const phc = active ? phOf(active.id) : phDefault()
  const exportCount = slides.length * enabled.length * (variants.length || 1)
  const readyCount = slides.filter((s) => s.line1.trim() || s.line2.trim()).length
  const localeList = locales.split(",").map((x) => x.trim()).filter(Boolean)
  const toggleLocale = (code: string) => setLocales((prev) => { const a = prev.split(",").map((x) => x.trim()).filter(Boolean); const i = a.indexOf(code); if (i >= 0) a.splice(i, 1); else a.push(code); return a.join(", ") })
  const phSide = active ? phOf(active.id).side : "left"
  const openSection = (sec: string) => { try { const el = document.querySelector(`details[data-sec="${sec}"]`) as HTMLDetailsElement | null; if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "nearest" }) } } catch {} }
  const headRect: React.CSSProperties = mode === "ph" ? (phSide === "left" ? { left: "50%", right: "3%", top: "8%", bottom: "8%" } : { left: "3%", right: "50%", top: "8%", bottom: "8%" }) : (layout === "headline-bottom" ? { left: "8%", right: "8%", bottom: "2%", height: "24%" } : { left: "8%", right: "8%", top: "2%", height: "24%" })
  const styleRect: React.CSSProperties = mode === "ph" ? (phSide === "left" ? { left: "2%", width: "46%", top: "8%", bottom: "8%" } : { right: "2%", width: "46%", top: "8%", bottom: "8%" }) : (layout === "headline-bottom" ? { left: "8%", right: "8%", top: "2%", height: "70%" } : { left: "8%", right: "8%", bottom: "2%", height: "70%" })


  return (
    <div className="app">
      <div className="topbar">
        <h1 className="brand"><img src="/brand/mark.png" alt="" className="brand-mark" />Launch <span>Studio</span><span className="sr-only"> — turn app screenshots into App Store, Google Play and Product Hunt kits</span></h1>
        <div className="inline-flex items-center gap-1 rounded-lg bg-secondary p-[3px]">
          <Button size="sm" variant={mode === "store" ? "default" : "ghost"} className="h-7" onClick={() => setMode("store")}><span style={{ display: "inline-flex", gap: 3, marginRight: 2 }}><AppStoreIcon s={15} /><GooglePlayIcon s={15} /></span>Store kit</Button>
          <Button size="sm" variant={mode === "ph" ? "default" : "ghost"} className="h-7" onClick={() => setMode("ph")}><ProductHuntIcon s={15} />Product Hunt</Button>
        </div>
        <div className="muted count">{slides.length} screen{slides.length === 1 ? "" : "s"}</div>
        <div className="spacer" />
        {hydrated && slides.length > 0 && saved && <span className="muted saveind">{saved === "saving" ? "Saving…" : "Saved ✓"}</span>}
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle light or dark theme" title="Toggle theme">{uiTheme === "dark" ? "☀️" : "🌙"}</button>
        {busy && <div className="muted">{busy}</div>}
        {slides.length > 0 && (mode === "store"
          ? <Button disabled={!enabled.length || !!busy} onClick={() => setShowExport(true)}>Export {exportCount} asset{exportCount === 1 ? "" : "s"}</Button>
          : <Button disabled={!!busy} onClick={() => setShowExport(true)}>Export {slides.length} image{slides.length === 1 ? "" : "s"}</Button>)}
      </div>

{!hydrated ? (
        <div className="onboard"><div className="spin" /></div>
      ) : slides.length === 0 ? (
        <div className="onboard"><div className="onboard-inner">
          <img className="onboard-dawg" src="/brand/mark.png" alt="Launch Studio" />
          <h2>Create your first screenshot kit</h2>
          <p className="onboard-sub">Turn raw app screenshots into polished App Store, Google Play, and Product Hunt visuals — in minutes.</p>
          <p className="onboard-dawgline">That ain’t no screenshot tool. It’s a dawg — drop ’em in.</p>
          <div className="onboard-modes">
            <button className={"mode-card" + (mode === "store" ? " active" : "")} onClick={() => setMode("store")}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                <span style={{ display: "inline-flex", gap: 8, flexShrink: 0 }}><AppStoreIcon s={36} /><GooglePlayIcon s={36} /></span>
                <span><div className="mode-title">App Store &amp; Google Play Kit</div>
                <div className="mode-desc">Device screenshots + store-ready exports in every required size.</div></span>
              </div>
            </button>
            <button className={"mode-card" + (mode === "ph" ? " active" : "")} onClick={() => setMode("ph")}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                <ProductHuntIcon s={36} />
                <span><div className="mode-title">Product Hunt Launch Kit</div>
                <div className="mode-desc">Landscape gallery images and launch visuals — 1270×760.</div></span>
              </div>
            </button>
          </div>
          <div className="onboard-cta">
            <Button asChild><label {...uploadKey} className="cursor-pointer">Upload screenshots<input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} /></label></Button>
            <Button variant="outline" onClick={loadExamples}>Load demo project</Button>
          </div>
          <div className="onboard-hint">PNG, JPG, or WebP • paste with ⌘V / Ctrl+V • Recommended: 3–10 screens</div>
          <div className="onboard-steps"><div><span>1</span> Upload screens</div><div><span>2</span> Pick a style</div><div><span>3</span> Export ready-to-use assets</div></div>
        </div></div>
      ) : (
      <div className="cols">
        {/* LEFT: screens */}
        <div className="panel">
          <div className="section">
            <h3>Screens</h3>
            <div className="row">
              <Button asChild size="sm" variant="secondary" className="flex-1">
                <label {...uploadKey} className="cursor-pointer text-center">+ Upload<input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} /></label>
              </Button>
              <Button size="sm" variant="outline" onClick={loadExamples}>Example</Button>
            </div>
          </div>
          <div className="section slide-rail" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {slides.length === 0 && <div className="muted">Upload app screenshots or load the example kit.</div>}
            {slides.map((s, i) => (
              <div key={s.id} role="button" tabIndex={0} aria-current={s.id === activeId ? "true" : undefined}
                className={"slide" + (s.id === activeId ? " active" : "") + (dragOverId === s.id ? " dragover" : "")}
                draggable
                onDragStart={(e) => { dragIndexRef.current = i; e.dataTransfer.effectAllowed = "move" }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverId !== s.id) setDragOverId(s.id) }}
                onDragLeave={() => setDragOverId((d) => (d === s.id ? null : d))}
                onDrop={(e) => { e.preventDefault(); moveSlide(dragIndexRef.current, i); setDragOverId(null); dragIndexRef.current = null }}
                onDragEnd={() => { setDragOverId(null); dragIndexRef.current = null }}
                onClick={() => setActiveId(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(s.id) } else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); moveSlide(i, i - 1) } else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); moveSlide(i, i + 1) } }}>
                <span className="grip" aria-hidden>⠿</span>
                <img src={s.url} alt={s.name} />
                <div className="meta"><div className="n">{s.line1 || s.name}</div><div className="h">{s.line2 || "No headline yet"}</div></div>
                <button className="x" aria-label="Remove screen" title="Remove" onClick={(e) => { e.stopPropagation(); removeSlide(s.id) }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: preview */}
        <div className="stage">
          {mode === "store" && (
            <div className="tabs">
              {allTargets.map((t) => (
                <Pill key={t.id} active={t.id === activeStore} onClick={() => setActiveStore(t.id)} className="rounded-full"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PlatformIcon platform={t.platform} s={15} />{t.label}</span></Pill>
              ))}
            </div>
          )}
          <div className="preview" style={{ position: "relative" }}>
            {active ? <canvas ref={previewRef} role="img" aria-label={`Live preview of ${active?.name || "your screenshot"}`} /> : <div className="empty">Add a screen to see the live preview. The engine renders right here in your browser — no server.</div>}
            {active && previewBusy && <div className="preview-spin"><div className="spin" /></div>}
            {active && (
              <div className="hotspots">
                <button className="hot" style={headRect} onClick={() => openSection("content")} aria-label="Edit text"><span>✎ Edit text</span></button>
                <button className="hot" style={styleRect} onClick={() => openSection("style")} aria-label="Edit background and device"><span>🎨 Edit style</span></button>
              </div>
            )}
          </div>
          {active ? (
            <div className="canvas-bar">
              <div className="cbar-left">
                <button className="cbtn" disabled={activeIdx <= 0} onClick={() => gotoSlide(activeIdx - 1)} aria-label="Previous slide">‹</button>
                <span>Slide {activeIdx + 1} of {slides.length}</span>
                <button className="cbtn" disabled={activeIdx >= slides.length - 1} onClick={() => gotoSlide(activeIdx + 1)} aria-label="Next slide">›</button>
              </div>
              <span className="muted">{mode === "store" ? `${store.width} × ${store.height}` : "1270 × 760"}{fontsReady ? "" : " · loading…"}</span>
            </div>
          ) : null}
        </div>

        {/* RIGHT: inspector */}
        <div className="panel right">
          {mode === "store" ? (
            <>
              <details className="acc" open data-sec="content">
                <summary>Content</summary>
                <div className="acc-body">
                  {active ? (
                    <>
                      <CopyField label="Headline" value={active.line1} limit={30} onChange={(e) => updateActive({ line1: e.target.value })} />
                      <CopyField label="Highlighted line" value={active.line2} limit={30} onChange={(e) => updateActive({ line2: e.target.value })} />
                    </>
                  ) : <div className="muted">Select a screen to edit its copy.</div>}
                  <Button className="w-full mt-1" disabled={!slides.length || !!busy} onClick={autoHeadlines}>✨ Generate headline ideas</Button>
                  <div className="row" style={{ marginTop: 8 }}>
                    <Button size="sm" variant="outline" className="flex-1" disabled={!slides.length || !!busy} onClick={autoHeadlines}>Generate again</Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled={!active || !!busy} onClick={genOptions}>Tone &amp; style</Button>
                  </div>
                  {options.length > 0 && (
                    <div className="opts">{options.map((o, i) => (
                      <button key={i} className="opt" onClick={() => { updateActive({ line1: o.line1, line2: o.line2 }); setOptions([]) }}><b>{o.line1 || "No line 1"}</b><span>{o.line2}</span></button>
                    ))}</div>
                  )}
                  <Button variant="secondary" className="w-full mt-2" disabled={!active || !!busy} onClick={downloadActive}>⬇ Download PNG</Button>
                </div>
              </details>

              <details className="acc" data-sec="style">
                <summary>Style</summary>
                <div className="acc-body">
                  <label className="sublabel" style={{ marginTop: 0 }}>Background</label>
                  <div className="swatches">{swatchList.map((pp) => (
                    <button key={pp.key} aria-label={pp.label} aria-pressed={pp.key === themeKey} className={"swatch" + (pp.key === themeKey ? " active" : "")} style={{ background: pp.theme.background.kind === "mesh" ? `linear-gradient(135deg, ${pp.theme.background.colors.join(", ")})` : `linear-gradient(135deg, ${pp.theme.background.from}, ${pp.theme.background.to})` }} onClick={() => setThemeKey(pp.key)}><span style={{ color: pp.theme.headlineColor }}>{pp.label}</span></button>
                  ))}</div>
                  <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                    <input type="color" className="color-in" aria-label="Brand color" value={brandColor} onChange={(e) => { setBrandColor(e.target.value); setCustom(themeFromColors(e.target.value, darken(e.target.value, 0.42))) }} />
                    <Button size="sm" variant="outline" className="flex-1" disabled={!active} onClick={matchScreenshot}>🎨 Extract colors</Button>
                  </div>
                  <label className="sublabel">Device frame</label>
                  <div className="dev-swatches">{(["titanium", "black", "silver"] as const).map((c) => (
                    <button key={c} type="button" aria-pressed={deviceColor === c} className={"dev-sw" + (deviceColor === c ? " active" : "")} onClick={() => setDeviceColor(c)} aria-label={c}><span className={"dev-chip dev-" + c} /><span className="dev-name">{c}</span></button>
                  ))}</div>
                  <Button asChild size="sm" variant="secondary" className="w-full mt-2"><label {...uploadKey} className="cursor-pointer text-center">{frameUrl ? "Change mockup" : "+ Upload your own mockup"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFrameUrl((prev) => { if (prev) { try { URL.revokeObjectURL(prev) } catch {} } return URL.createObjectURL(f) }); setTemplateMode(true) } }} /></label></Button>
                  {frameUrl && (<div className="row" style={{ marginTop: 8, alignItems: "center" }}><label className="check flex-1"><Switch checked={templateMode} onCheckedChange={setTemplateMode} /><span>Template-faithful mode</span></label><Button size="sm" variant="outline" onClick={() => { setFrameUrl(null); setTemplateMode(false) }}>Remove</Button></div>)}
                  <label className="sublabel">Headline font</label>
                  <select className="select" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>{FONT_OPTIONS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}</select>
                </div>
              </details>

              <details className="acc">
                <summary>Layout</summary>
                <div className="acc-body">
                  <label className="sublabel" style={{ marginTop: 0 }}>Headline position</label>
                  <div className="layout-cards">
                    <button type="button" className={"lay-card" + (layout === "headline-top" ? " active" : "")} onClick={() => setLayout("headline-top")}><span className="lay-dia"><span className="lay-txt" /><span className="lay-ph" /></span><span className="lay-name">Headline top</span></button>
                    <button type="button" className={"lay-card" + (layout === "headline-bottom" ? " active" : "")} onClick={() => setLayout("headline-bottom")}><span className="lay-dia lay-rev"><span className="lay-txt" /><span className="lay-ph" /></span><span className="lay-name">Headline bottom</span></button>
                  </div>
                  <label className="check" style={{ marginTop: 12 }}><Switch checked={safeArea} onCheckedChange={setSafeArea} /><span>Safe-area guides (preview)</span></label>
                </div>
              </details>

              <details className="acc">
                <summary>Advanced</summary>
                <div className="acc-body">
                  <label className="sublabel" style={{ marginTop: 0 }}>Gradient style</label>
                  <div className="row" style={{ flexWrap: "wrap" }}>{(["diagonal", "vertical", "radial", "conic", "spotlight"] as const).map((gs) => (<Pill key={gs} active={gradientStyle === gs} className="capitalize" disabled={theme.background.kind === "mesh"} onClick={() => setGradientStyle(gs)}>{gs}</Pill>))}</div>
                  {theme.background.kind === "mesh" && <div className="muted" style={{ marginTop: 4 }}>Pick a non-mesh preset to use gradient styles.</div>}
                  <label className="sublabel">Texture</label>
                  <div className="range-row"><label>Intensity</label><input className="range" type="range" min={0} max={100} value={noiseIntensity} onChange={(e) => setNoiseIntensity(+e.target.value)} /><span className="rv">{noiseIntensity}</span></div>
                  <div className="range-row"><label>Grain size</label><input className="range" type="range" min={1} max={6} value={noiseSize} onChange={(e) => setNoiseSize(+e.target.value)} /><span className="rv">{noiseSize}px</span></div>
                  <div className="range-row"><label>Grain count</label><input className="range" type="range" min={5} max={100} value={Math.round(noiseDensity * 100)} onChange={(e) => setNoiseDensity(+e.target.value / 100)} /><span className="rv">{Math.round(noiseDensity * 100)}%</span></div>
                  <label className="sublabel">A/B experiment</label>
                  {(experiment || variants.length > 0) ? (
                    <>
                      <div className="muted" style={{ marginBottom: 8 }}>Pick themes to test — each ships as its own variant folder.</div>
                      <div className="stores">{PRESETS.map((pp) => (<label key={pp.key} className="check"><Checkbox checked={variants.includes(pp.key)} onCheckedChange={(v) => setVariants((cur) => (v ? [...new Set([...cur, pp.key])] : cur.filter((x) => x !== pp.key)))} /><span>{pp.label}</span></label>))}</div>
                      {variants.length > 0 && <div className="muted" style={{ marginTop: 8 }}>{variants.length} variant{variants.length === 1 ? "" : "s"} × {enabled.length} format{enabled.length === 1 ? "" : "s"} × {slides.length} screen{slides.length === 1 ? "" : "s"} = <b>{exportCount} exports</b></div>}
                      <Button size="sm" variant="ghost" className="w-full mt-1" onClick={() => { setExperiment(false); setVariants([]) }}>Cancel experiment</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setExperiment(true)}>＋ Create A/B experiment</Button>
                  )}
                </div>
              </details>

              <details className="acc">
                <summary>AI &amp; localization</summary>
                <div className="acc-body">
                  <div className="field" style={{ marginBottom: 6 }}><label>AI provider key — optional (BYOK)</label><Input type="password" placeholder="sk-…  reads your screens, writes headlines" value={aiKey} onChange={(e) => setAiKey(e.target.value)} /><div className="row" style={{ marginTop: 6, alignItems: "center", justifyContent: "space-between" }}><label style={{ fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} />Remember on this device</label>{aiKey ? <button type="button" className="cbtn" onClick={() => { setAiKey(""); setRememberKey(false) }}>Clear</button> : null}</div><div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{rememberKey ? "Stored in this browser." : "Session only — cleared when the tab closes."}</div></div>
                  <div className="muted">With a key, “Generate headline ideas” reads your screenshots with a vision model. Blank = offline templates. Your key stays in this browser.</div>
                  <label className="sublabel" style={{ marginTop: 10 }}>Launch brief <span className="muted" style={{ fontWeight: 400 }}>— sharpens AI headlines (optional)</span></label>
                  <div className="field"><label htmlFor="lb-name">App name</label><Input id="lb-name" value={brief.name} onChange={(e) => setBrief((b) => ({ ...b, name: e.target.value }))} placeholder="e.g. Flowent" /></div>
                  <div className="field"><label htmlFor="lb-aud">Audience</label><Input id="lb-aud" value={brief.audience} onChange={(e) => setBrief((b) => ({ ...b, audience: e.target.value }))} placeholder="e.g. busy language learners" /></div>
                  <div className="field"><label htmlFor="lb-ben">Core benefit</label><Input id="lb-ben" value={brief.benefit} onChange={(e) => setBrief((b) => ({ ...b, benefit: e.target.value }))} placeholder="e.g. speak from day one" /></div>
                  <div className="field"><label htmlFor="lb-tone">Tone</label><Input id="lb-tone" value={brief.tone} onChange={(e) => setBrief((b) => ({ ...b, tone: e.target.value }))} placeholder="e.g. confident, friendly" /></div>
                  <label className="sublabel" style={{ marginTop: 10 }}>Translate to</label>
                  <div className="chips">{LANGS.map(([code, name]) => (
                    <button key={code} type="button" className={"chip" + (localeList.includes(code) ? " active" : "")} onClick={() => toggleLocale(code)}>{name}</button>
                  ))}</div>
                  {localeList.includes("ar") && <div className="muted" style={{ marginTop: 6 }}>Arabic is right-to-left — review layout after export.</div>}
                  <div className="muted" style={{ marginTop: 6 }}>{localeList.length ? `${localeList.length} language${localeList.length === 1 ? "" : "s"} — exported into per-locale folders (needs an AI key).` : "Pick languages to export translated copy (needs an AI key)."}</div>
                </div>
              </details>

              <details className="acc">
                <summary>Preflight</summary>
                <div className="acc-body">
                  {(() => {
                    const proj = [
                      { ok: slides.length >= 3 && slides.length <= 10, label: `${slides.length} screen${slides.length === 1 ? "" : "s"}`, hint: slides.length < 3 ? "Add at least 3 for the stores" : slides.length > 10 ? "Stores show ~10 max" : "Good count" },
                      { ok: slides.length > 0 && readyCount === slides.length, label: `${readyCount}/${slides.length} have a headline`, hint: slides.length && readyCount === slides.length ? "All set" : "Some slides have no copy" },
                      { ok: enabled.length > 0, label: `${enabled.length} export format${enabled.length === 1 ? "" : "s"}`, hint: enabled.length ? "Good" : "Pick at least one format" },
                      { ok: exportCount <= 40, label: `${exportCount} asset${exportCount === 1 ? "" : "s"} to export`, hint: exportCount <= 40 ? "Reasonable" : "Large — may be slow; trim formats or variants" },
                      { ok: !localeList.length || !!aiKey.trim(), label: `${localeList.length} extra language${localeList.length === 1 ? "" : "s"}`, hint: !localeList.length ? "English only" : aiKey.trim() ? "Will translate on export" : "Needs an AI key to translate" },
                    ]
                    return <div className="checks">{proj.map((c, i) => (<div key={i} className={"crow " + (c.ok ? "ok" : "warn")}><span className="dot" />{c.label}<span className="hint">{c.hint}</span></div>))}</div>
                  })()}
                  <label className="sublabel" style={{ marginTop: 10 }}>This screen</label>
                  {active ? (() => {
                    const bg = theme.background.kind === "mesh" ? theme.background.colors[Math.floor(theme.background.colors.length / 2)] : theme.background.from
                    const cr = contrastRatio(theme.headlineColor, bg); const len = Math.max(active.line1.length, active.line2.length); const empty = !active.line1.trim() && !active.line2.trim()
                    const rows = [
                      { ok: !empty, label: empty ? "Headline missing" : "Headline present", hint: empty ? "Add copy for this slide" : "Good" },
                      { ok: cr >= 3, label: `Contrast ${cr.toFixed(1)}:1`, hint: cr >= 3 ? "Good" : "Low — adjust background or headline" },
                      { ok: len > 0 && len <= 22, label: `Length ${len}/22`, hint: len === 0 ? "Empty" : len <= 22 ? "Reads at thumbnail" : "Too long for the store grid" },
                      { ok: safeArea, label: "Safe-area guides", hint: safeArea ? "On" : "Turn on to keep text off edges" },
                    ]
                    return <div className="checks">{rows.map((c, i) => (<div key={i} className={"crow " + (c.ok ? "ok" : "warn")}><span className="dot" />{c.label}<span className="hint">{c.hint}</span></div>))}</div>
                  })() : <div className="muted">Select a screen.</div>}
                  <button type="button" className="cbtn" style={{ marginTop: 12 }} onClick={() => { if (window.confirm("Clear all locally saved projects, screenshots and settings? This cannot be undone.")) { try { localStorage.removeItem("launch-studio.project"); localStorage.removeItem("launch-studio.aiKey"); sessionStorage.removeItem("launch-studio.aiKey"); idbClear() } catch {} location.reload() } }}>Clear local data</button>
                </div>
              </details>
            </>
          ) : (
            <>
              <details className="acc" open data-sec="content">
                <summary>Content</summary>
                <div className="acc-body">
                  {active ? (
                    <>
                      <CopyField label="Eyebrow (optional)" value={phc.kicker} limit={40} onChange={(e) => setPh(active.id, { kicker: e.target.value })} placeholder="CREATE REAL-LIFE SCENARIOS" />
                      <CopyField label="Headline" value={phc.line1} limit={30} onChange={(e) => setPh(active.id, { line1: e.target.value })} />
                      <CopyField label="Highlighted line" value={phc.line2} limit={30} onChange={(e) => setPh(active.id, { line2: e.target.value })} />
                      <CopyField label="Supporting copy" value={phc.sub} limit={120} onChange={(e) => setPh(active.id, { sub: e.target.value })} placeholder="One supporting line" />
                      <label className="sublabel">Device</label>
                      <div className="row"><Pill active={(phc.device ?? "phone") === "phone"} onClick={() => setPh(active.id, { device: "phone" })}>📱 Phone</Pill><Pill active={phc.device === "safari"} onClick={() => setPh(active.id, { device: "safari" })}>🧭 Safari</Pill></div>
                      {phc.device === "safari" ? (
                        <>
                          <CopyField label="Address bar (URL)" value={phc.url ?? ""} limit={40} onChange={(e) => setPh(active.id, { url: e.target.value })} placeholder="yourapp.com" />
                          <div className="muted" style={{ marginTop: 6 }}>Safari window suits wide desktop / web screenshots. The headline sits on top.</div>
                        </>
                      ) : (
                        <>
                          <label className="sublabel">Phone side</label>
                          <div className="row"><Pill active={phc.side === "left"} onClick={() => setPh(active.id, { side: "left" })}>Left</Pill><Pill active={phc.side === "right"} onClick={() => setPh(active.id, { side: "right" })}>Right</Pill></div>
                        </>
                      )}
                      <Button variant="secondary" className="w-full mt-3" disabled={!!busy} onClick={downloadActivePH}>⬇ Download PNG</Button>
                    </>
                  ) : <div className="muted">Select a screen to edit its copy.</div>}
                </div>
              </details>

              <details className="acc" data-sec="style">
                <summary>Style</summary>
                <div className="acc-body">
                  <label className="sublabel" style={{ marginTop: 0 }}>Background</label>
                  <div className="swatches">{swatchList.map((pp) => (
                    <button key={pp.key} aria-label={pp.label} aria-pressed={pp.key === themeKey} className={"swatch" + (pp.key === themeKey ? " active" : "")} style={{ background: pp.theme.background.kind === "mesh" ? `linear-gradient(135deg, ${pp.theme.background.colors.join(", ")})` : `linear-gradient(135deg, ${pp.theme.background.from}, ${pp.theme.background.to})` }} onClick={() => setThemeKey(pp.key)}><span style={{ color: pp.theme.headlineColor }}>{pp.label}</span></button>
                  ))}</div>
                  <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                    <input type="color" className="color-in" aria-label="Brand color" value={brandColor} onChange={(e) => { setBrandColor(e.target.value); setCustom(themeFromColors(e.target.value, darken(e.target.value, 0.42))) }} />
                    <Button size="sm" variant="outline" className="flex-1" disabled={!active} onClick={matchScreenshot}>🎨 Extract colors</Button>
                  </div>
                  <label className="sublabel">Device frame</label>
                  <div className="dev-swatches">{(["titanium", "black", "silver"] as const).map((c) => (
                    <button key={c} type="button" aria-pressed={deviceColor === c} className={"dev-sw" + (deviceColor === c ? " active" : "")} onClick={() => setDeviceColor(c)} aria-label={c}><span className={"dev-chip dev-" + c} /><span className="dev-name">{c}</span></button>
                  ))}</div>
                  <label className="sublabel">Headline font</label>
                  <select className="select" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>{FONT_OPTIONS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}</select>
                </div>
              </details>

              <details className="acc">
                <summary>Advanced</summary>
                <div className="acc-body">
                  <label className="sublabel" style={{ marginTop: 0 }}>Gradient style</label>
                  <div className="row" style={{ flexWrap: "wrap" }}>{(["diagonal", "vertical", "radial", "conic", "spotlight"] as const).map((gs) => (<Pill key={gs} active={gradientStyle === gs} className="capitalize" disabled={theme.background.kind === "mesh"} onClick={() => setGradientStyle(gs)}>{gs}</Pill>))}</div>
                  <label className="sublabel">Texture</label>
                  <div className="range-row"><label>Intensity</label><input className="range" type="range" min={0} max={100} value={noiseIntensity} onChange={(e) => setNoiseIntensity(+e.target.value)} /><span className="rv">{noiseIntensity}</span></div>
                  <div className="range-row"><label>Grain size</label><input className="range" type="range" min={1} max={6} value={noiseSize} onChange={(e) => setNoiseSize(+e.target.value)} /><span className="rv">{noiseSize}px</span></div>
                  <div className="range-row"><label>Grain count</label><input className="range" type="range" min={5} max={100} value={Math.round(noiseDensity * 100)} onChange={(e) => setNoiseDensity(+e.target.value / 100)} /><span className="rv">{Math.round(noiseDensity * 100)}%</span></div>
                  <div className="muted" style={{ marginTop: 8 }}>Product Hunt images export at the 1270 × 760 ratio, 2.5× for crisp detail.</div>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
      )}

      {showExport && (
        <div className="drawer-scrim" onClick={() => setShowExport(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export settings">
            <div className="drawer-head"><h3>Your export includes</h3><button className="x" onClick={() => setShowExport(false)} aria-label="Close">×</button></div>
            {mode === "store" ? (
              <>
                <div className="export-summary">
                  {enabled.length === 0 && <div className="muted">Pick at least one format below.</div>}
                  {enabled.map((id) => { const t = allTargets.find((x) => x.id === id)!; return (<div key={id} className="exrow"><b>{slides.length}</b> <span style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "middle" }}><PlatformIcon platform={t.platform} s={15} />{t.label}</span> <span className="muted">· {t.width}×{t.height}</span></div>) })}
                </div>
                <div className="muted" style={{ marginBottom: 10 }}>PNG · high resolution · English{variants.length ? ` · ${variants.length} A/B variant${variants.length === 1 ? "" : "s"}` : ""}</div>
                <label className="sublabel" style={{ marginTop: 0 }}>Export formats</label>
                <div className="stores">{allTargets.map((t) => (<label key={t.id} className="check"><Checkbox checked={enabled.includes(t.id)} onCheckedChange={(v) => setEnabled((cur) => (v ? [...new Set([...cur, t.id])] : cur.filter((x) => x !== t.id)))} /><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PlatformIcon platform={t.platform} s={15} />{t.label} <span className="muted">· {t.width}×{t.height}</span></span></label>))}</div>
                {variants.length > 0 && <div className="muted" style={{ marginBottom: 10 }}>{variants.length} variant{variants.length === 1 ? "" : "s"} × {enabled.length} format{enabled.length === 1 ? "" : "s"} × {slides.length} screen{slides.length === 1 ? "" : "s"} = <b>{exportCount} exports</b>{exportCount > 40 ? " — that is a lot, consider trimming." : ""}</div>}
                <Button className="w-full mt-3" disabled={!enabled.length || !!busy} onClick={() => { setShowExport(false); exportZip() }}>Export {exportCount} asset{exportCount === 1 ? "" : "s"} (ZIP)</Button>
              </>
            ) : (
              <>
                <div className="export-summary"><div className="exrow"><b>{slides.length}</b> <span style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "middle" }}><ProductHuntIcon s={15} />Product Hunt gallery image{slides.length === 1 ? "" : "s"}</span> <span className="muted">· 1270×760</span></div></div>
                <div className="muted" style={{ marginBottom: 10 }}>PNG · 2.5× high resolution</div>
                <Button className="w-full mt-3" disabled={!!busy} onClick={() => { setShowExport(false); exportPH() }}>Export {slides.length} image{slides.length === 1 ? "" : "s"} (ZIP)</Button>
              </>
            )}
          </div>
        </div>
      )}

      {busy && (<div className="busy-overlay"><div className="card"><div className="spin" /><div>{busy}</div>{progress && <div className="muted" style={{ marginTop: 6 }}>{progress.done} / {progress.total}</div>}</div></div>)}
    </div>
  )
}
