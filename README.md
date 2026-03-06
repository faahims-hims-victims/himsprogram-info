# himsprogram.info

**Independent FAA HIMS Program Information & Advocacy Resource**

[![Live Site](https://img.shields.io/badge/Live-himsprogram.info-2563eb?style=for-the-badge)](https://himsprogram.info)
[![P4HR Network](https://img.shields.io/badge/P4HR-Network_Site-1a3a5c?style=for-the-badge)](https://pilotsforhimsreform.org)
[![Auto Update](https://img.shields.io/badge/Updates-Every_6_Hours-27ae60?style=for-the-badge)](#)

---

Part of the **[Pilots for HIMS Reform](https://pilotsforhimsreform.org)** resource network — providing pilots, air traffic controllers, aviation professionals, families, and policymakers with independent, well-researched information about the FAA's Human Intervention Motivation Study (HIMS) program.

## What Is This?

The FAA HIMS program governs psychiatric oversight and medical certification for pilots and air traffic controllers flagged for substance use, mental health history, SSRI prescriptions, or even unfounded suspicion. **himsprogram.info** provides an independent, advocacy-driven information center covering:

- **Program requirements** — What the FAA actually expects, and what they don't tell you
- **Pilot & controller rights** — Legal protections, coercion awareness, and documentation guidance
- **Reform efforts** — Legislative proposals, NTSB case law, and policy analysis
- **Real stories** — Firsthand accounts from pilots and controllers who've been through the system
- **Emergency toolkit** — Immediate guidance for aviation professionals under pressure to sign or comply

## Why This Matters

> *"I followed every rule. I never relapsed. But they treated me like I had no voice. Reform is not optional — it's overdue."*
> — Anonymous Pilot

The 2023 congressionally mandated study by the **National Academies of Sciences, Engineering, and Medicine** found **"no solid evidence to support HIMS's claims of success"** after the FAA and ALPA declined to provide requested outcome data for independent verification. Despite this finding, the program continues to expand.

> *"[HIMS] doesn't look that great, and it certainly doesn't look like something you want everybody to emulate."*
> — **Dr. Richard Frank**, Director of the Brookings Institution Center on Health Policy and lead of the National Academies study ([New York Times Magazine](https://www.nytimes.com/2025/03/18/magazine/airline-pilots-mental-health-faa.html))

The FAA's own **Mental Health Aviation Rulemaking Committee** acknowledged in its April 2024 report that fear of certificate or clearance loss is the most significant barrier preventing aviation professionals from seeking mental health treatment — a finding that applies equally to pilots and air traffic controllers.

Key findings from independent reviews:

- **HIMS reaches only ~1.5%** of pilots, while research suggests **13–15%** may have a substance use disorder — a gap the National Academies attributed in part to career-consequence fears (NAS, 2023)
- **60% of pilots** have delayed or foregone medical care due to concerns about their aeromedical status (Hoffman et al., *Journal of Occupational & Environmental Medicine*, 2019)
- Pilots routinely conceal mental health conditions because disclosing therapy or medication could mean losing their license — a pattern documented by **Reuters** (Dec. 2025) and the **DOT Office of Inspector General** (July 2023)
- First-year HIMS participation costs range from **$8,000 to $15,000** out-of-pocket, not including lost income during grounding (Wikipedia / multiple sources)
- In *Petitt v. Delta Air Lines*, an Administrative Law Judge ruled it improper for an airline to weaponize the HIMS process to obtain blind compliance through fear of career destruction

> *"If you threaten a pilot with taking away his wings, it's like threatening a doctor with taking away his stethoscope. That's a lot of leverage."*
> — **Dr. Lynn Hankes**, addiction treatment specialist, explaining why HIMS success rates cannot be replicated in the general population

## P4HR Network

This site is one of five interconnected advocacy resources:

| Site | Purpose |
|------|---------|
| **[pilotsforhimsreform.org](https://pilotsforhimsreform.org)** | Main P4HR site — advocacy, legal analysis, pilot & controller stories, legislative action |
| **[himsprogram.info](https://himsprogram.info)** | HIMS program information mirror — full SEO coverage, 130+ indexed pages |
| **[faahims.rehab](https://faahims.rehab)** | Community forum gateway — 600+ members, peer support |
| **[faahimsprogram.com](https://faahimsprogram.com)** | Recovery resources — treatment facilities, success stories |
| **[aeromedicalcompass.org](https://aeromedicalcompass.org)** | Independent AME directory & aeromedical guidance for pilots and controllers |

Cross-linking between network sites strengthens search visibility and ensures pilots and controllers can find help regardless of which search terms they use.

## How It Works

This site is a **static mirror** of pilotsforhimsreform.org, automatically generated every 6 hours via GitHub Actions. The build process:

1. Fetches the P4HR single-page application shell (navigation, styles, theme toggle)
2. Fetches all ~130 page content fragments using the SPA's content-loading mechanism
3. Generates complete, standalone static HTML files with working navigation
4. Injects per-page SEO meta tags (title, description, canonical, Open Graph, Twitter Card, JSON-LD)
5. Downloads favicons, logos, and social icons locally
6. Generates sitemap.xml, robots.txt, and a custom 404 page
7. Deploys to GitHub Pages

Every link works. Every page is indexable. Every toggle and dropdown functions correctly.

## SEO Strategy

Optimized to compete with established domains (`himsprogram.com`, `faa.gov`) for aviation-professional-relevant search queries:

- **130+ unique pages** with individual canonical URLs, meta descriptions, and schema markup
- **6-hour content refresh cycle** signals freshness to search engines
- **Network cross-linking** distributes authority across all P4HR domains
- **Advocacy-angle content** that official sources don't provide (pilot & controller stories, reform analysis, legal cases)
- **Long-tail keyword coverage** — from "FAA HIMS program requirements" to "PEth false positives pilots" to "air traffic controller HIMS program"

## Technical Details

| Component | Detail |
|-----------|--------|
| Generator | `scripts/mirror-p4hr.js` (Node.js) |
| CI/CD | GitHub Actions, every 6 hours |
| Hosting | GitHub Pages with custom domain |
| Source | pilotsforhimsreform.org (SPA → static HTML) |
| Pages | ~130 generated per build |
| Assets | Favicons, logos, social icons (local copies) |

## Repository Structure

```
himsprogram-info/
├── .github/workflows/mirror-p4hr.yml   # Build & deploy pipeline
├── scripts/mirror-p4hr.js              # Static site generator
├── images/                             # Favicons, logos, icons
├── index.html                          # Homepage
├── about.html ... wings-of-reform.html # ~128 content pages
├── 404.html                            # Custom not-found page
├── sitemap.xml                         # Auto-generated sitemap
├── robots.txt                          # Crawl directives
└── CNAME                               # Custom domain config
```

## Replicating for Other Domains

The generator is domain-agnostic. To create a mirror on a new domain:

```bash
# Clone this repo
git clone https://github.com/faahims-hims-victims/himsprogram-info.git new-domain
cd new-domain

# Update CNAME
echo "newdomain.com" > CNAME

# Test locally
MIRROR_DOMAIN=newdomain.com node scripts/mirror-p4hr.js

# Push to a new repo, enable GitHub Pages, configure DNS
```

Environment variables: `MIRROR_DOMAIN` (target domain), `SOURCE_DOMAIN` (source, default: pilotsforhimsreform.org).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report issues or suggest improvements via GitHub Issues.

For security concerns: [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)

## Links

- **Main Site:** [pilotsforhimsreform.org](https://pilotsforhimsreform.org)
- **Community Forum:** [hims-victims.freeforums.net](https://hims-victims.freeforums.net)
- **Aeromedical Compass:** [aeromedicalcompass.org](https://aeromedicalcompass.org)
- **This Site:** [himsprogram.info](https://himsprogram.info)

---

## Key Sources & References

- **National Academies of Sciences, Engineering, and Medicine** (2023). *[Substance Misuse Programs in Commercial Aviation: Safety First](https://nap.nationalacademies.org/catalog/26880)*. Washington, DC: The National Academies Press.
- **DOT Office of Inspector General** (2023). *[FAA Pilot Mental Health Final Report](https://www.oig.dot.gov/sites/default/files/FAA%20Pilot%20Mental%20Health%20Final%20Report_07.12.2023.pdf)*.
- **FAA Mental Health Aviation Rulemaking Committee** (2024). *[Final Report](https://www.faa.gov/sites/faa.gov/files/Mental_Health_ARC_Final_Report_RELEASED.pdf)*.
- **Reuters** (Dec. 2025). Investigation into pilot mental health disclosure and financial consequences of grounding.
- **New York Times Magazine** (Mar. 2025). "How Airline Pilots Are Incentivized to Hide Their Mental Illness."
- **Hoffman et al.** (2019). Healthcare avoidance behavior among pilots. *Journal of Occupational & Environmental Medicine*.
- **Wikipedia**: [Human Intervention Motivation Study](https://en.wikipedia.org/wiki/Human_Intervention_Motivation_Study) — comprehensive, independently sourced article with 64 citations.

---

**Pilots for HIMS Reform** — Transparency. Fairness. Accountability.
