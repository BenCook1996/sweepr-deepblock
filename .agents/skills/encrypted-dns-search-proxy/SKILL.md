---
name: encrypted-dns-search-proxy
description: >-
  Use this skill when implementing the Tracker-Free Search Engine & Encrypted DNS Proxy
  bundle module, including URL tracking parameter stripping and DNS-over-HTTPS (DoH) protection.
---

# Tracker-Free Search & Encrypted DNS Proxy Skill

## Core Capabilities

1. **Declarative URL Tracking Parameter Stripper**
   - Use Manifest V3 `declarativeNetRequest` `redirect` rules (`transform.queryTransform.removeParams`) to strip cross-site tracking parameters before the request leaves the browser:
     - Google/YouTube: `gclid`, `gclsrc`, `dclid`, `si`
     - Meta/Facebook/Instagram: `fbclid`, `igshid`
     - Microsoft/Bing: `msclkid`
     - Analytics & Email Trackers: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `mc_cid`, `mc_eid`, `_hsenc`, `_hsmi`, `vero_id`, `mkt_tok`
   - Strip Google `/url?q=` redirect wrappers so outbound search clicks navigate directly to the destination URL without intermediary click logging.

2. **Encrypted DNS-over-HTTPS (DoH) & CNAME-Cloaking Defense**
   - Provide a 1-click toggle in the extension dashboard for **DeepDNS Encrypted Protection** (routing DNS resolution queries via zero-log DoH endpoints such as AdGuard/Mullvad/NextDNS-compatible JSON DoH resolvers to detect CNAME-cloaked first-party tracking subdomains).
   - Provide a **Tracker-Free Search Mode** toggle that strips search telemetry cookies and forces clean, unpersonalized search parameters (`udm=14` clean web filter option on Google to hide AI Overviews & sponsored clutter).
