import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:        "var(--bg)",
        surface:   "var(--surface)",
        surfaceUp: "var(--surface-up)",
        border:    "var(--border)",
        brand:     "var(--brand)",
        brandDim:  "#B45309",
        brandGlow: "var(--brand-glow)",
        amber:     "#F59E0B",
        red:       "#EF4444",
        textPrimary:   "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        textDim:       "var(--text-dim)",
        
        // Legacy aliases
        brass:     "var(--brand)",
        sage:      "#10B981",
        ember:     "var(--brand)",
        card:      "var(--surface)",
        "card-soft": "var(--surface-up)",
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        graphite:  "var(--surface)",
        obsidian:  "var(--bg)",
      },
      boxShadow: {
        panel: "0 12px 48px rgba(0,0,0,0.08)",
        glow:  "0 0 24px rgba(0,122,255,0.25)",
        "glow-sm": "0 0 12px rgba(0,122,255,0.15)",
        jarvis: "0 0 30px rgba(0, 122, 255, 0.2), inset 0 0 20px rgba(0, 122, 255, 0.05)",
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "scanline": "scanline 3s linear infinite",
        "data-flow": "data-flow 2s infinite linear",
        "spin-slow": "spin 8s linear infinite",
        "marquee": "marquee 20s linear infinite",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0,122,255,0.4)" },
          "50%":      { boxShadow: "0 0 0 10px rgba(0,122,255,0)" },
        },
        "scanline": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(200%)" },
        },
        "data-flow": {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        }
      },
    },
  },
  plugins: [],
};

export default config;
