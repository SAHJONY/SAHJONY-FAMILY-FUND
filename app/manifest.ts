import type { MetadataRoute } from "next";

// PWA manifest — makes SAHJONY CAPITAL LLC installable on any device
// (Add to Home Screen on iOS/Android, Install on desktop Chrome/Edge).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SAHJONY CAPITAL LLC",
    short_name: "SAHJONY",
    description: "SAHJONY CAPITAL LLC — deterministic multi-asset monitor & quant trading lab",
    start_url: "/fund",
    display: "standalone",
    orientation: "any",
    background_color: "#06090f",
    theme_color: "#06090f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
