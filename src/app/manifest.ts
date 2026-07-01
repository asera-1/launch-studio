import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Launch Studio",
    short_name: "Launch Studio",
    description: "Turn app screenshots into App Store, Google Play and Product Hunt kits.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1430",
    theme_color: "#0b1430",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
