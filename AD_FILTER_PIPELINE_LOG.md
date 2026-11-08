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

## Run `adpipe-2026-10-29-vb4qy` — 2026-10-29T00:05:30.745Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 34
- **Rules Auto-Patched (Verified Self-Healing):** 34
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 209 MV3 Static DNR Rules | 255 ABP/uBO Rules | 39 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `2de903e`

| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| `https://recipehub.co.uk` | Script | `||sublime.xyz^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||sublime.xyz^$third-party,script,xmlhttprequest blocks sublime.xyz while preserving recipehub.co.uk first-party layout & scripts. |
| `https://cloudstandard.nl` | DOM | `cloudstandard.nl##.monetag-push-ad` | **Auto-Patched** | Verified: Cosmetic rule cloudstandard.nl##.monetag-push-ad collapses ad container (.monetag-push-ad) with main content wrappers and scroll state intact. |
| `https://arcadeguide.ca` | DOM | `arcadeguide.ca##.invibes-infeed-ad` | **Auto-Patched** | Verified: Cosmetic rule arcadeguide.ca##.invibes-infeed-ad collapses ad container (.invibes-infeed-ad) with main content wrappers and scroll state intact. |
| `https://gadgetdigest.au` | DOM | `gadgetdigest.au##.brid-video-ad` | **Auto-Patched** | Verified: Cosmetic rule gadgetdigest.au##.brid-video-ad collapses ad container (.brid-video-ad) with main content wrappers and scroll state intact. |
| `https://cyberzone.nl` | Script | `||sonobi.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||sonobi.com^$third-party,script,xmlhttprequest blocks sonobi.com while preserving cyberzone.nl first-party layout & scripts. |
| `https://buzzreport.com` | DOM | `buzzreport.com##.inmobi-ad-unit` | **Auto-Patched** | Verified: Cosmetic rule buzzreport.com##.inmobi-ad-unit collapses ad container (.inmobi-ad-unit) with main content wrappers and scroll state intact. |
| `https://buzztoday.net` | Network | `||smartclip.net^$third-party` | **Auto-Patched** | Verified: ||smartclip.net^$third-party blocks smartclip.net while preserving buzztoday.net first-party layout & scripts. |
| `https://cyberexpress.info` | Script | `||richaudience.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||richaudience.com^$third-party,script,xmlhttprequest blocks richaudience.com while preserving cyberexpress.info first-party layout & scripts. |
| `https://beygir.com` | Script | `||revive-adserver.net^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||revive-adserver.net^$third-party,script,xmlhttprequest blocks revive-adserver.net while preserving beygir.com first-party layout & scripts. |
| `https://bossbeacon.ca` | Script | `||strossle.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||strossle.com^$third-party,script,xmlhttprequest blocks strossle.com while preserving bossbeacon.ca first-party layout & scripts. |
| `https://buzzbulletin.de` | Network | `||adkernel.com^$third-party` | **Auto-Patched** | Verified: ||adkernel.com^$third-party blocks adkernel.com while preserving buzzbulletin.de first-party layout & scripts. |
| `https://tribunedigest.net` | Script | `||inmobi.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||inmobi.com^$third-party,script,xmlhttprequest blocks inmobi.com while preserving tribunedigest.net first-party layout & scripts. |
| `https://recipespot.nl` | Script | `||invibes.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||invibes.com^$third-party,script,xmlhttprequest blocks invibes.com while preserving recipespot.nl first-party layout & scripts. |
| `https://kernelbeat.gg` | Script | `||playstream.media^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||playstream.media^$third-party,script,xmlhttprequest blocks playstream.media while preserving kernelbeat.gg first-party layout & scripts. |
| `https://lootstream.fr` | DOM | `lootstream.fr##.brid-video-ad` | **Auto-Patched** | Verified: Cosmetic rule lootstream.fr##.brid-video-ad collapses ad container (.brid-video-ad) with main content wrappers and scroll state intact. |
| `https://gadgetnation.com` | Script | `||brid.tv^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||brid.tv^$third-party,script,xmlhttprequest blocks brid.tv while preserving gadgetnation.com first-party layout & scripts. |
| `https://dailynetwork.news` | DOM | `dailynetwork.news##.invibes-infeed-ad` | **Auto-Patched** | Verified: Cosmetic rule dailynetwork.news##.invibes-infeed-ad collapses ad container (.invibes-infeed-ad) with main content wrappers and scroll state intact. |
| `https://showbiztoday.news` | Network | `||fastclick.net^$third-party` | **Auto-Patched** | Verified: ||fastclick.net^$third-party blocks fastclick.net while preserving showbiztoday.news first-party layout & scripts. |
| `https://arenahub.fr` | DOM | `arenahub.fr##.showheroes-ad-player` | **Auto-Patched** | Verified: Cosmetic rule arenahub.fr##.showheroes-ad-player collapses ad container (.showheroes-ad-player) with main content wrappers and scroll state intact. |
| `https://spicedigest.info` | Script | `||showheroes.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||showheroes.com^$third-party,script,xmlhttprequest blocks showheroes.com while preserving spicedigest.info first-party layout & scripts. |
| `https://cyberjournal.tv` | DOM | `cyberjournal.tv##.invibes-infeed-ad` | **Auto-Patched** | Verified: Cosmetic rule cyberjournal.tv##.invibes-infeed-ad collapses ad container (.invibes-infeed-ad) with main content wrappers and scroll state intact. |
| `https://observerindex.org` | Script | `||alwingulla.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||alwingulla.com^$third-party,script,xmlhttprequest blocks alwingulla.com while preserving observerindex.org first-party layout & scripts. |
| `https://streamfocus.jp` | DOM | `streamfocus.jp##.showheroes-ad-player` | **Auto-Patched** | Verified: Cosmetic rule streamfocus.jp##.showheroes-ad-player collapses ad container (.showheroes-ad-player) with main content wrappers and scroll state intact. |
| `https://questplanet.es` | DOM | `questplanet.es##.monetag-push-ad` | **Auto-Patched** | Verified: Cosmetic rule questplanet.es##.monetag-push-ad collapses ad container (.monetag-push-ad) with main content wrappers and scroll state intact. |
| `https://spicewire.com` | DOM | `spicewire.com##.brid-video-ad` | **Auto-Patched** | Verified: Cosmetic rule spicewire.com##.brid-video-ad collapses ad container (.brid-video-ad) with main content wrappers and scroll state intact. |

## Run `adpipe-2026-10-29-1oxxe` — 2026-10-29T03:19:23.539Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 13
- **Rules Auto-Patched (Verified Self-Healing):** 13
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 210 MV3 Static DNR Rules | 268 ABP/uBO Rules | 40 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `5889dae`

| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| `https://gazettepulse.it` | DOM | `gazettepulse.it##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule gazettepulse.it##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://devstream.org` | Network | `||targetspot.com^$third-party` | **Auto-Patched** | Verified: ||targetspot.com^$third-party blocks targetspot.com while preserving devstream.org first-party layout & scripts. |
| `https://bingewatch.tv` | DOM | `bingewatch.tv##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule bingewatch.tv##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://raidglobe.news` | DOM | `raidglobe.news##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule raidglobe.news##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://skilletworld.gg` | DOM | `skilletworld.gg##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule skilletworld.gg##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://screenjournal.net` | DOM | `screenjournal.net##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule screenjournal.net##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://newsvine.com` | DOM | `newsvine.com##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule newsvine.com##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://tpb.vn` | DOM | `tpb.vn##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule tpb.vn##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://craveindex.news` | DOM | `craveindex.news##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule craveindex.news##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://craveguide.com` | DOM | `craveguide.com##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule craveguide.com##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://animeindex.ca` | DOM | `animeindex.ca##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule animeindex.ca##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://buzzworld.com` | DOM | `buzzworld.com##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule buzzworld.com##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |
| `https://chroniclemedia.net` | DOM | `chroniclemedia.net##.targetspot-ad` | **Auto-Patched** | Verified: Cosmetic rule chroniclemedia.net##.targetspot-ad collapses ad container (.targetspot-ad) with main content wrappers and scroll state intact. |

## Run `adpipe-2026-10-29-hjx6a` — 2026-10-29T08:10:27.663Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 210 MV3 Static DNR Rules | 298 ABP/uBO Rules | 40 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `93cdca2`

## Run `adpipe-2026-10-30-5bbmt` — 2026-10-30T00:03:50.376Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 210 MV3 Static DNR Rules | 298 ABP/uBO Rules | 40 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `19bde15`

## Run `adpipe-2026-10-31-l82af` — 2026-10-31T07:00:02.851Z
- **Sites Sampled (30-Day Deduplicated):** 5
- **Sites Evaluated:** 5
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 210 MV3 Static DNR Rules | 298 ABP/uBO Rules | 40 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `d5d9aac`

## Run `adpipe-2026-10-31-qsn9m` — 2026-10-31T07:04:36.919Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 210 MV3 Static DNR Rules | 298 ABP/uBO Rules | 40 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `d5d9aac`

## Run `adpipe-2026-10-31-g52vo` — 2026-10-31T07:06:12.361Z
- **Sites Sampled (30-Day Deduplicated):** 20
- **Sites Evaluated:** 20
- **Ad Leaks Detected:** 1
- **Rules Auto-Patched (Verified Self-Healing):** 1
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 211 MV3 Static DNR Rules | 299 ABP/uBO Rules | 41 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `dd39150`

| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| `https://foodiepress.org` | Script | `||targetvideo.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||targetvideo.com^$third-party,script,xmlhttprequest blocks targetvideo.com while preserving foodiepress.org first-party layout & scripts. |

## Run `adpipe-2026-10-31-5ed0s` — 2026-10-31T07:06:24.549Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 36
- **Rules Auto-Patched (Verified Self-Healing):** 31
- **Flagged for Manual Review:** 5
- **Repository Ruleset Totals:** 230 MV3 Static DNR Rules | 330 ABP/uBO Rules | 60 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `dd39150`

| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| `https://screentimes.org` | DOM | `screentimes.org##.coinzilla-ad` | **Auto-Patched** | Verified: Cosmetic rule screentimes.org##.coinzilla-ad collapses ad container (.coinzilla-ad) with main content wrappers and scroll state intact. |
| `https://adacado.com` | Network | `||smaato.net^$third-party` | **Auto-Patched** | Verified: ||smaato.net^$third-party blocks smaato.net while preserving adacado.com first-party layout & scripts. |
| `https://popcentral.fr` | Script | `||smartstream.tv^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||smartstream.tv^$third-party,script,xmlhttprequest blocks smartstream.tv while preserving popcentral.fr first-party layout & scripts. |
| `https://bakezone.com` | DOM | `bakezone.com##.fyber-ad-wrapper` | **Auto-Patched** | Verified: Cosmetic rule bakezone.com##.fyber-ad-wrapper collapses ad container (.fyber-ad-wrapper) with main content wrappers and scroll state intact. |
| `https://circuitscoop.net` | DOM | `circuitscoop.net##.adman-outstream-slot` | **Auto-Patched** | Verified: Cosmetic rule circuitscoop.net##.adman-outstream-slot collapses ad container (.adman-outstream-slot) with main content wrappers and scroll state intact. |
| `https://arenapress.me` | DOM | `arenapress.me##.smartstream-video-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".smartstream-video-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://cloudonline.tv` | DOM | `cloudonline.tv##.a-ads-banner` | **Auto-Patched** | Verified: Cosmetic rule cloudonline.tv##.a-ads-banner collapses ad container (.a-ads-banner) with main content wrappers and scroll state intact. |
| `https://animejournal.co.uk` | Script | `||coinzilla.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||coinzilla.com^$third-party,script,xmlhttprequest blocks coinzilla.com while preserving animejournal.co.uk first-party layout & scripts. |
| `https://nhacso.net` | Script | `||contentexchange.me^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||contentexchange.me^$third-party,script,xmlhttprequest blocks contentexchange.me while preserving nhacso.net first-party layout & scripts. |
| `https://generalmobi.com` | Script | `||glispa.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||glispa.com^$third-party,script,xmlhttprequest blocks glispa.com while preserving generalmobi.com first-party layout & scripts. |
| `https://devbulletin.org` | DOM | `devbulletin.org##.yieldlove-ad-slot` | **Auto-Patched** | Verified: Cosmetic rule devbulletin.org##.yieldlove-ad-slot collapses ad container (.yieldlove-ad-slot) with main content wrappers and scroll state intact. |
| `https://cybernetwork.us` | Network | `||admixer.net^$third-party` | **Auto-Patched** | Verified: ||admixer.net^$third-party blocks admixer.net while preserving cybernetwork.us first-party layout & scripts. |
| `https://cravestandard.de` | Script | `||adspirit.de^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||adspirit.de^$third-party,script,xmlhttprequest blocks adspirit.de while preserving cravestandard.de first-party layout & scripts. |
| `https://buzzcentral.es` | Script | `||adsterra.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||adsterra.com^$third-party,script,xmlhttprequest blocks adsterra.com while preserving buzzcentral.es first-party layout & scripts. |
| `https://buzzworld.com` | DOM | `buzzworld.com##.smartstream-video-slot` | **Failed Verification - Needs Manual Review** | Rejected: DOM selector ".smartstream-video-slot" lacks explicit ad-namespace specificity; queued for manual review. |
| `https://bytewatch.es` | Network | `||adtarget.me^$third-party` | **Auto-Patched** | Verified: ||adtarget.me^$third-party blocks adtarget.me while preserving bytewatch.es first-party layout & scripts. |
| `https://gadgethub.au` | Script | `||admanmedia.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||admanmedia.com^$third-party,script,xmlhttprequest blocks admanmedia.com while preserving gadgethub.au first-party layout & scripts. |
| `https://savorystream.au` | DOM | `savorystream.au###carbonads` | **Auto-Patched** | Verified: Cosmetic rule savorystream.au###carbonads collapses ad container (#carbonads) with main content wrappers and scroll state intact. |
| `https://popnation.us` | Script | `||sunmedia.tv^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||sunmedia.tv^$third-party,script,xmlhttprequest blocks sunmedia.tv while preserving popnation.us first-party layout & scripts. |
| `https://bossip.com` | Script | `||a-ads.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||a-ads.com^$third-party,script,xmlhttprequest blocks a-ads.com while preserving bossip.com first-party layout & scripts. |
| `https://insiderdigest.es` | DOM | `insiderdigest.es##.coinzilla-ad` | **Auto-Patched** | Verified: Cosmetic rule insiderdigest.es##.coinzilla-ad collapses ad container (.coinzilla-ad) with main content wrappers and scroll state intact. |
| `https://dispatchonline.gg` | Script | `||fyber.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||fyber.com^$third-party,script,xmlhttprequest blocks fyber.com while preserving dispatchonline.gg first-party layout & scripts. |
| `https://insiderpress.co.uk` | Script | `||adblade.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||adblade.com^$third-party,script,xmlhttprequest blocks adblade.com while preserving insiderpress.co.uk first-party layout & scripts. |
| `https://showbizledger.it` | DOM | `showbizledger.it##.infolinks-ad-unit` | **Auto-Patched** | Verified: Cosmetic rule showbizledger.it##.infolinks-ad-unit collapses ad container (.infolinks-ad-unit) with main content wrappers and scroll state intact. |
| `https://siliconhub.it` | Script | `||carbonads.com^$third-party,script,xmlhttprequest` | **Auto-Patched** | Verified: ||carbonads.com^$third-party,script,xmlhttprequest blocks carbonads.com while preserving siliconhub.it first-party layout & scripts. |

## Run `adpipe-2026-11-01-4rzx0` — 2026-11-01T00:03:51.897Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 230 MV3 Static DNR Rules | 330 ABP/uBO Rules | 60 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `2c985e5`

## Run `adpipe-2026-11-02-0560w` — 2026-11-02T00:04:28.207Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 230 MV3 Static DNR Rules | 330 ABP/uBO Rules | 60 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `632bfc4`

## Run `adpipe-2026-11-02-a3d7e` — 2026-11-02T03:10:48.711Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 230 MV3 Static DNR Rules | 330 ABP/uBO Rules | 60 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `83fdb45`

## Run `adpipe-2026-11-03-uyhdc` — 2026-11-03T04:26:53.030Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 230 MV3 Static DNR Rules | 330 ABP/uBO Rules | 60 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 5/5 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `6de27d8`

## Run `adpipe-2026-11-04-wnrc0` — 2026-11-04T00:05:02.289Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 242 MV3 Static DNR Rules | 374 ABP/uBO Rules | 72 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `04521ef`

## Run `adpipe-2026-11-04-nkeal` — 2026-11-04T08:02:43.264Z
- **Sites Sampled (30-Day Deduplicated):** 5
- **Sites Evaluated:** 5
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 265 MV3 Static DNR Rules | 453 ABP/uBO Rules | 95 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `ac741d7`

## Run `adpipe-2026-11-04-49aht` — 2026-11-04T08:04:03.596Z
- **Sites Sampled (30-Day Deduplicated):** 5
- **Sites Evaluated:** 5
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 232 MV3 Static DNR Rules | 389 ABP/uBO Rules | 91 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `ac741d7`

## Run `adpipe-2026-11-05-d0kki` — 2026-11-05T00:06:44.966Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 232 MV3 Static DNR Rules | 389 ABP/uBO Rules | 91 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `4b67102`

## Run `adpipe-2026-11-06-o3han` — 2026-11-06T00:05:33.620Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 232 MV3 Static DNR Rules | 389 ABP/uBO Rules | 91 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `3ec9b9d`

## Run `adpipe-2026-11-07-2bziu` — 2026-11-07T18:21:08.672Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 232 MV3 Static DNR Rules | 389 ABP/uBO Rules | 91 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `5ff7628`

## Run `adpipe-2026-11-08-928b9` — 2026-11-08T00:04:59.745Z
- **Sites Sampled (30-Day Deduplicated):** 1000
- **Sites Evaluated:** 1000
- **Ad Leaks Detected:** 0
- **Rules Auto-Patched (Verified Self-Healing):** 0
- **Flagged for Manual Review:** 0
- **Repository Ruleset Totals:** 232 MV3 Static DNR Rules | 389 ABP/uBO Rules | 91 OTA Delta Rules
- **Cross-Site Non-Regression Suite:** PASS (15/15 Golden Network & DeepStealth Surrogate Canaries | 10/10 Legitimate Site Canaries Unblocked | 24 Cross-Module Selectors Protected)
- **Git Commit / Deployment Ref:** `5c7b9ad`

