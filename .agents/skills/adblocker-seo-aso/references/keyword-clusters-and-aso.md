# Adblocker Keyword Clusters & ASO Reference

## 1. High-Converting Keyword Matrix

| Cluster | Search Intent | Example Target Keywords | Target Page Type | Expected Conversion to Install/Trial |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Pain-Point** | Transactional / Urgent Problem | `block youtube ads without warning`, `twitch adblock extension`, `stop popups on streaming sites`, `remove news paywall overlays` | Dedicated Use-Case Landing Page (with 5-sec GIF demo) | **8% – 18%** |
| **Ecosystem Shift (MV3)** | Switching / Commercial | `manifest v3 adblocker that works`, `ublock origin chrome replacement`, `best adblocker after chrome update` | Technical Comparison & Migration Guide | **10% – 22%** |
| **Competitor Alternatives** | Bottom-of-Funnel | `total adblock alternative no auto renewal`, `adguard vs [brand]`, `1blocker alternative`, `pie adblock privacy review` | Side-by-Side Feature & Pricing Matrix | **12% – 25%** |
| **Device & OS Specific** | Transactional | `system wide adblocker windows`, `ios safari content blocker low battery`, `android dns adblock no root` | OS-Targeted Download Funnel | **7% – 15%** |
| **Performance & Security** | Problem-Aware | `stop fake virus popups chrome`, `why is chrome using so much ram`, `block fingerprinting trackers` | Educational Guide + Embedded "Leak Test" Widget | **3% – 8%** |

---

## 2. Chrome Web Store (CWS) & Apple App Store Ranking Factors

### Chrome Web Store Algorithm Weights
1. **Keyword Match in Name & Short Description**: Highest lexical weight. Avoid keyword stuffing (triggers manual review rejection).
2. **Install-to-Uninstall Ratio (Churn)**: If users install and remove the extension within 24 hours, CWS demotes search visibility rapidly.
   - *Mitigation*: Never lock basic page ad-blocking behind a hard credit-card wall on minute 1. Provide immediate blocking or a frictionless trial, and use an uninstall survey URL (`chrome.runtime.setUninstallURL`) to capture feedback and offer a discount/fix.
3. **Review Velocity & Rating Average**: Aim for steady daily reviews rather than sudden spikes.
4. **Localization**: Translating `manifest.json` (`_locales/`) and store descriptions into Top 12 languages (EN, DE, FR, ES, PT-BR, JA, KO, PL, NL, IT, TR, SV) unlocks low-competition regional store rankings.

---

## 3. JSON-LD Schema Template for Adblocker Sales Pages

Include on all core landing pages to maximize rich snippets and AI citation visibility:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "YourAdBlocker Pro",
  "operatingSystem": "Windows, macOS, Android, iOS, Chrome, Firefox, Edge, Safari",
  "applicationCategory": "SecurityApplication",
  "offers": {
    "@type": "Offer",
    "price": "1.99",
    "priceCurrency": "GBP"
  }
}
```
