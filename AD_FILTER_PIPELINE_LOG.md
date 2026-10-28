# SWEEPR DeepBlock — Daily 1,000-Site Ad-Filter Pipeline Audit Log

Automated daily 24-hour pipeline (`00:00 UTC`) sampling 1,000 unique ad-heavy domains (30-day rolling deduplication), detecting unblocked network/DOM/script ads, synthesizing & self-healing verifying MV3 + ABP rules, and syncing to the SWEEPR CRM.

## Run `adpipe-2026-10-25-3g109` — 2026-10-25T11:15:29.887Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 26
- **Rules Auto-Patched (Verified Self-Healing):** 21
- **Flagged for Manual Review:** 5
- **Repository Ruleset Totals:** 171 MV3 Static DNR Rules | 181 ABP/uBO Rules | 8 OTA Delta Rules
- **Git Commit / Deployment Ref:** `aff5a0a`

| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| `https://giantfreakinrobot.com` | Script | `||snigelweb.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||snigelweb.com^$third-party,script,xmlhttprequest blocks snigelweb.com while preserving giantfreakinrobot.com first-party layout & scripts. |
| `https://rawstory.com` | DOM | `rawstory.com##.freestar-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule rawstory.com##.freestar-ad-slot collapses ad container (.freestar-ad-slot) with main content wrappers and scroll state intact. |
| `https://metacritic.com` | Network | `||springserve.com^$third-party` | **Auto-Patched** | Verified: ||springserve.com^$third-party blocks springserve.com while preserving metacritic.com first-party layout & scripts. |
| `https://variety.com` | Script | `||blogherads.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||blogherads.com^$third-party,script,xmlhttprequest blocks blogherads.com while preserving variety.com first-party layout & scripts. |
| `https://makeuseof.com` | Network | `||mfadsrvr.com^$third-party` | **Auto-Patched** | Verified: ||mfadsrvr.com^$third-party blocks mfadsrvr.com while preserving makeuseof.com first-party layout & scripts. |
| `https://flightradar24.com` | Script | `||pub.network^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||pub.network^$third-party,script,xmlhttprequest blocks pub.network while preserving flightradar24.com first-party layout & scripts. |
| `https://slashdot.org` | DOM | `slashdot.org##.springserve-vast-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".springserve-vast-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://cars.com` | Script | `||adnxs-simple.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||adnxs-simple.com^$third-party,script,xmlhttprequest blocks adnxs-simple.com while preserving cars.com first-party layout & scripts. |
| `https://bistrobeacon.de` | Script | `||ezojs.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||ezojs.com^$third-party,script,xmlhttprequest blocks ezojs.com while preserving bistrobeacon.de first-party layout & scripts. |
| `https://commercialintegrator.com` | DOM | `commercialintegrator.com##.snigel-ad-unit` | **Auto-Patched** | Verified: Cosmetic rule commercialintegrator.com##.snigel-ad-unit collapses ad container (.snigel-ad-unit) with main content wrappers and scroll state intact. |
| `https://doji.vn` | DOM | `doji.vn##.wknd-sponsored-box` | **Auto-Patched** | Verified: Cosmetic rule doji.vn##.wknd-sponsored-box collapses ad container (.wknd-sponsored-box) with main content wrappers and scroll state intact. |
| `https://questbeacon.info` | DOM | `questbeacon.info##.freestar-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule questbeacon.info##.freestar-ad-slot collapses ad container (.freestar-ad-slot) with main content wrappers and scroll state intact. |
| `https://arcademagazine.nl` | DOM | `arcademagazine.nl##.wknd-sponsored-box` | **Auto-Patched** | Verified: Cosmetic rule arcademagazine.nl##.wknd-sponsored-box collapses ad container (.wknd-sponsored-box) with main content wrappers and scroll state intact. |
| `https://cravestream.com` | Script | `||wknd.ai^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||wknd.ai^$third-party,script,xmlhttprequest blocks wknd.ai while preserving cravestream.com first-party layout & scripts. |
| `https://metrowatch.co.uk` | DOM | `metrowatch.co.uk##.snigel-ad-unit` | **Auto-Patched** | Verified: Cosmetic rule metrowatch.co.uk##.snigel-ad-unit collapses ad container (.snigel-ad-unit) with main content wrappers and scroll state intact. |
| `https://kitchenreport.info` | DOM | `kitchenreport.info##.mediaforce-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule kitchenreport.info##.mediaforce-ad-slot collapses ad container (.mediaforce-ad-slot) with main content wrappers and scroll state intact. |
| `https://buzzbulletin.io` | DOM | `buzzbulletin.io##.apnx-banner-300x250` | **Auto-Patched** | Verified: Cosmetic rule buzzbulletin.io##.apnx-banner-300x250 collapses ad container (.apnx-banner-300x250) with main content wrappers and scroll state intact. |
| `https://bytefocus.gg` | DOM | `bytefocus.gg##.apnx-banner-300x250` | **Auto-Patched** | Verified: Cosmetic rule bytefocus.gg##.apnx-banner-300x250 collapses ad container (.apnx-banner-300x250) with main content wrappers and scroll state intact. |
| `https://postzone.info` | DOM | `postzone.info##.springserve-vast-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".springserve-vast-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://foodiedigest.org` | DOM | `foodiedigest.org##.springserve-vast-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".springserve-vast-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://pixelzone.ca` | DOM | `pixelzone.ca##.mediaforce-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule pixelzone.ca##.mediaforce-ad-slot collapses ad container (.mediaforce-ad-slot) with main content wrappers and scroll state intact. |
| `https://arenawatch.org` | DOM | `arenawatch.org##.wknd-sponsored-box` | **Auto-Patched** | Verified: Cosmetic rule arenawatch.org##.wknd-sponsored-box collapses ad container (.wknd-sponsored-box) with main content wrappers and scroll state intact. |
| `https://kernelplanet.de` | DOM | `kernelplanet.de##.springserve-vast-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".springserve-vast-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://questwatch.it` | DOM | `questwatch.it##.springserve-vast-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".springserve-vast-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://gazettereview.fr` | DOM | `gazettereview.fr##.mediaforce-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule gazettereview.fr##.mediaforce-ad-slot collapses ad container (.mediaforce-ad-slot) with main content wrappers and scroll state intact. |

## Run `adpipe-2026-10-25-1ukfx` — 2026-10-25T11:30:09.724Z
- **Sites Sampled (30-Day Deduplicated):** 50
- **Sites Evaluated:** 50
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 171 MV3 Static DNR Rules | 181 ABP/uBO Rules | 0 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** ROLLED BACK (13/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `aff5a0a`

## Run `adpipe-2026-10-25-4lh36` — 2026-10-25T11:31:11.422Z
- **Sites Sampled (30-Day Deduplicated):** 50
- **Sites Evaluated:** 50
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 171 MV3 Static DNR Rules | 181 ABP/uBO Rules | 8 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `aff5a0a`

## Run `adpipe-2026-10-28-0tfki` — 2026-10-28T00:18:43.569Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 40
- **Rules Auto-Patched (Verified Self-Healing):** 40
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 192 MV3 Static DNR Rules | 221 ABP/uBO Rules | 22 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `1a667b9`

| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| `https://bingejournal.jp` | DOM | `bingejournal.jp##.kargo-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule bingejournal.jp##.kargo-ad-slot collapses ad container (.kargo-ad-slot) with main content wrappers and scroll state intact. |
| `https://pixelhub.de` | DOM | `pixelhub.de##.vidoomy-video-ad` | **Auto-Patched** | Verified: Cosmetic rule pixelhub.de##.vidoomy-video-ad collapses ad container (.vidoomy-video-ad) with main content wrappers and scroll state intact. |
| `https://circuitwatch.org` | DOM | `circuitwatch.org##.undertone-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule circuitwatch.org##.undertone-ad-slot collapses ad container (.undertone-ad-slot) with main content wrappers and scroll state intact. |
| `https://screenglobe.ca` | Script | `||seedtag.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||seedtag.com^$third-party,script,xmlhttprequest blocks seedtag.com while preserving screenglobe.ca first-party layout & scripts. |
| `https://raidplanet.co` | DOM | `raidplanet.co##.kargo-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule raidplanet.co##.kargo-ad-slot collapses ad container (.kargo-ad-slot) with main content wrappers and scroll state intact. |
| `https://popwire.it` | Network | `||colossusssp.com^$third-party` | **Auto-Patched** | Verified: ||colossusssp.com^$third-party blocks colossusssp.com while preserving popwire.it first-party layout & scripts. |
| `https://metroradar.net` | Script | `||kargo.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||kargo.com^$third-party,script,xmlhttprequest blocks kargo.com while preserving metroradar.net first-party layout & scripts. |
| `https://bistrobeacon.fr` | Script | `||adpushup.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||adpushup.com^$third-party,script,xmlhttprequest blocks adpushup.com while preserving bistrobeacon.fr first-party layout & scripts. |
| `https://bakeplanet.io` | Script | `||intergi.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||intergi.com^$third-party,script,xmlhttprequest blocks intergi.com while preserving bakeplanet.io first-party layout & scripts. |
| `https://siliconmirror.gg` | DOM | `siliconmirror.gg##.invibes-infeed-ad` | **Auto-Patched** | Verified: Cosmetic rule siliconmirror.gg##.invibes-infeed-ad collapses ad container (.invibes-infeed-ad) with main content wrappers and scroll state intact. |
| `https://savorymedia.de` | Script | `||m2.ai^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||m2.ai^$third-party,script,xmlhttprequest blocks m2.ai while preserving savorymedia.de first-party layout & scripts. |
| `https://nexushub.me` | Network | `||adnuntius.com^$third-party` | **Auto-Patched** | Verified: ||adnuntius.com^$third-party blocks adnuntius.com while preserving nexushub.me first-party layout & scripts. |
| `https://cravenation.org` | DOM | `cravenation.org##.vidoomy-video-ad` | **Auto-Patched** | Verified: Cosmetic rule cravenation.org##.vidoomy-video-ad collapses ad container (.vidoomy-video-ad) with main content wrappers and scroll state intact. |
| `https://spicestandard.com` | Script | `||vidoomy.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||vidoomy.com^$third-party,script,xmlhttprequest blocks vidoomy.com while preserving spicestandard.com first-party layout & scripts. |
| `https://heraldradar.org` | DOM | `heraldradar.org##.adnuntius-ad-box` | **Auto-Patched** | Verified: Cosmetic rule heraldradar.org##.adnuntius-ad-box collapses ad container (.adnuntius-ad-box) with main content wrappers and scroll state intact. |
| `https://pixeldigest.es` | DOM | `pixeldigest.es##.adnuntius-ad-box` | **Auto-Patched** | Verified: Cosmetic rule pixeldigest.es##.adnuntius-ad-box collapses ad container (.adnuntius-ad-box) with main content wrappers and scroll state intact. |
| `https://todotorrents.com` | DOM | `todotorrents.com##.adnuntius-ad-box` | **Auto-Patched** | Verified: Cosmetic rule todotorrents.com##.adnuntius-ad-box collapses ad container (.adnuntius-ad-box) with main content wrappers and scroll state intact. |
| `https://byteindex.nl` | DOM | `byteindex.nl##.adnuntius-ad-box` | **Auto-Patched** | Verified: Cosmetic rule byteindex.nl##.adnuntius-ad-box collapses ad container (.adnuntius-ad-box) with main content wrappers and scroll state intact. |
| `https://gadgetmirror.net` | DOM | `gadgetmirror.net##.kargo-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule gadgetmirror.net##.kargo-ad-slot collapses ad container (.kargo-ad-slot) with main content wrappers and scroll state intact. |
| `https://savoryscoop.nl` | DOM | `savoryscoop.nl##.vidoomy-video-ad` | **Auto-Patched** | Verified: Cosmetic rule savoryscoop.nl##.vidoomy-video-ad collapses ad container (.vidoomy-video-ad) with main content wrappers and scroll state intact. |
| `https://skilletradar.es` | DOM | `skilletradar.es##.kargo-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule skilletradar.es##.kargo-ad-slot collapses ad container (.kargo-ad-slot) with main content wrappers and scroll state intact. |
| `https://spiceplanet.tv` | DOM | `spiceplanet.tv##.adnuntius-ad-box` | **Auto-Patched** | Verified: Cosmetic rule spiceplanet.tv##.adnuntius-ad-box collapses ad container (.adnuntius-ad-box) with main content wrappers and scroll state intact. |
| `https://animedigest.io` | DOM | `animedigest.io##.vidoomy-video-ad` | **Auto-Patched** | Verified: Cosmetic rule animedigest.io##.vidoomy-video-ad collapses ad container (.vidoomy-video-ad) with main content wrappers and scroll state intact. |
| `https://zappos.com` | Script | `||undertone.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||undertone.com^$third-party,script,xmlhttprequest blocks undertone.com while preserving zappos.com first-party layout & scripts. |
| `https://cloudcentral.nl` | DOM | `cloudcentral.nl##.invibes-infeed-ad` | **Auto-Patched** | Verified: Cosmetic rule cloudcentral.nl##.invibes-infeed-ad collapses ad container (.invibes-infeed-ad) with main content wrappers and scroll state intact. |

## Run `adpipe-2026-10-28-orlby` — 2026-10-28T02:54:38.948Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 192 MV3 Static DNR Rules | 221 ABP/uBO Rules | 22 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `cd498e4`

