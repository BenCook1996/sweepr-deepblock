# SWEEPR Deepblock — Store & Marketing Creatives Library

All 35 high-resolution creatives across the **5 Website-Inspired Creative Directions** are saved in this folder as strict **24-bit RGB PNGs (`colorType=2`, no alpha transparency)** so they can be used immediately across extension stores, social ad campaigns, Product Hunt, Reddit, and landing pages.

## Folder Structure

- **[`active-listing/`](./active-listing/)** *(Currently live on Chrome Web Store & Firefox AMO — Copy of Alternative 4)*
- **[`alternative-1-website-hero-pearl/`](./alternative-1-website-hero-pearl/)** — *Holographic Pearl & Alabaster Editorial (Direct `website/index.html` Hero Match)*
- **[`alternative-2-laptop-3d-box-studio/`](./alternative-2-laptop-3d-box-studio/)** — *MacBook Pro Frame & 3D Software Box Showcase (`website/order.html` Match)*
- **[`alternative-3-swiss-bento-scorecard/`](./alternative-3-swiss-bento-scorecard/)** — *Swiss Bento Architecture & Live Metric Cards (`website/index.html#features` Match)*
- **[`alternative-4-emerald-obsidian-daylight-split/`](./alternative-4-emerald-obsidian-daylight-split/)** — *Emerald Obsidian Left Panel + Daylight Browser Stage (`website/order.html` Modal + Daylight Browser Split)*
- **[`alternative-5-browser-first-loupe-zoom/`](./alternative-5-browser-first-loupe-zoom/)** — *Full-Width Daylight Browser + Floating Glass Magnifier*

## Assets Inside Each Folder (7 Files per Alternative)

| File Name | Dimensions | Format | Primary Channel Use |
| :--- | :--- | :--- | :--- |
| `slide-1-hero-before-after.png` | `1280 × 800` | 24-bit RGB PNG | Store Slide #1 (Hero YouTube 4K Before/After Split), Reddit/X Hero Post |
| `slide-2-video-streaming.png` | `1280 × 800` | 24-bit RGB PNG | Store Slide #2 (Live Extension Popup UI & Stream Shield), Product Hunt Gallery |
| `slide-3-cookie-autoreject.png` | `1280 × 800` | 24-bit RGB PNG | Store Slide #3 (<50ms Automatic GDPR/UK Cookie Rejector), Blog/Comparison Visuals |
| `slide-4-scam-shop-search.png` | `1280 × 800` | 24-bit RGB PNG | Store Slide #4 (Fake Online Shop Detector & Search Cleaner), Paid Social Ads |
| `slide-5-ram-tamer-privacy.png` | `1280 × 800` | 24-bit RGB PNG | Store Slide #5 (Total Tab & RAM Tamer + Zero Telemetry), Performance Benchmarks |
| `small-promo-440x280.png` | `440 × 280` | 24-bit RGB PNG | Chrome Web Store Small Promo Tile, Display Ad Sidebar Card |
| `marquee-promo-1400x560.png` | `1400 × 560` | 24-bit RGB PNG | Chrome Web Store Marquee Tile, OpenGraph / X Summary Large Image / Blog Banner |

## Regenerating Assets

To edit or re-export all 35 creatives at any time:
1. Edit [`website/store-creatives.html`](../website/store-creatives.html) (or preview at `http://localhost:3000/store-creatives`).
2. Run:
   ```bash
   node scripts/generate-store-assets.mjs
   ```
