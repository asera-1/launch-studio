import * as React from "react"

// Brand store marks used wherever a store is named in the UI.
// Kept compact and recognizable at small sizes (tabs ~15px, cards ~34px).

export function AppStoreIcon({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id="ls-as" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1FC9FF" />
          <stop offset="1" stopColor="#1A66F0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.4" fill="url(#ls-as)" />
      <g stroke="#fff" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M7.7 16.4 11.95 8.1 16.2 16.4" />
        <path d="M9.5 13.2h4.9" />
      </g>
    </svg>
  )
}

export function GooglePlayIcon({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <rect width="24" height="24" rx="5.4" fill="#fff" />
      <g transform="translate(2.6 2.4) scale(0.78)">
        <path fill="#4285F4" d="M3.4 3.3C3.1 3.5 3 3.9 3 4.4v15.2c0 .5.1.9.4 1.1l9.6-8.9L3.4 3.3Z" />
        <path fill="#34A853" d="M4.2 3 13 11.8 15.6 9.2 6.3 3.9C5.6 3.5 4.9 3.1 4.2 3Z" />
        <path fill="#EA4335" d="M4.2 21c.7-.1 1.4-.5 2.1-.9l9.3-5.3-2.6-2.6L4.2 21Z" />
        <path fill="#FBBC04" d="M16.8 9.9 14 12.7l2.8 2.8 3.4-1.9c.8-.5.8-1.6 0-2.1l-3.4-1.6Z" />
      </g>
    </svg>
  )
}

export function ProductHuntIcon({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill="#DA552F" />
      <g stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M9.8 17.6V6.7h3.5a3 3 0 0 1 0 6H9.8" />
      </g>
    </svg>
  )
}

export type StorePlatform = "app-store" | "google-play" | string

export function PlatformIcon({ platform, s = 16 }: { platform: StorePlatform; s?: number }) {
  if (platform === "app-store") return <AppStoreIcon s={s} />
  if (platform === "google-play") return <GooglePlayIcon s={s} />
  return <ProductHuntIcon s={s} />
}
