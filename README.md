# ✈️ himsprogram.info

**Independent FAA HIMS Program Information & Advocacy Resource**

[![Live Site](https://img.shields.io/badge/Live-himsprogram.info-2563eb?style=for-the-badge)](https://himsprogram.info)
[![P4HR Network](https://img.shields.io/badge/P4HR-Network_Site-1a3a5c?style=for-the-badge)](https://pilotsforhimsreform.org)
[![Auto Update](https://img.shields.io/badge/Updates-Every_6_Hours-27ae60?style=for-the-badge)](#)

---

Part of the **[Pilots for HIMS Reform](https://pilotsforhimsreform.org)** resource network — providing pilots, aviation professionals, families, and policymakers with independent, well-researched information about the FAA's Human Intervention Motivation Study (HIMS) program.

## 🔍 What Is This?

The FAA HIMS program governs psychiatric oversight and medical certification for pilots flagged for substance use, mental health history, SSRI prescriptions, or even unfounded suspicion. **himsprogram.info** provides an independent, advocacy-driven information center covering:

- **Program requirements** — What the FAA actually expects, and what they don't tell you
- **Pilot rights** — Legal protections, coercion awareness, and documentation guidance
- **Reform efforts** — Legislative proposals, NTSB case law, and policy analysis
- **Real stories** — Firsthand accounts from pilots who've been through the system
- **Emergency toolkit** — Immediate guidance for pilots under pressure to sign or comply

## 🌐 P4HR Network

This site is one of four interconnected advocacy resources:

| Site | Purpose |
|------|---------|
| **[pilotsforhimsreform.org](https://pilotsforhimsreform.org)** | Main P4HR site — advocacy, legal analysis, pilot stories, legislative action |
| **[himsprogram.info](https://himsprogram.info)** | HIMS program information mirror — full SEO coverage, 129+ indexed pages |
| **[faahims.rehab](https://faahims.rehab)** | Community forum gateway — 600+ members, peer support |
| **[faahimsprogram.com](https://faahimsprogram.com)** | Recovery resources — treatment facilities, success stories |

Cross-linking between network sites strengthens search visibility and ensures pilots can find help regardless of which search terms they use.

## ⚙️ How It Works

This site is a **static mirror** of pilotsforhimsreform.org, automatically generated every 6 hours via GitHub Actions. The build process:

1. Fetches the P4HR single-page application shell (navigation, styles, theme toggle)
2. Fetches all ~130 page content fragments using the SPA's content-loading mechanism
3. Generates complete, standalone static HTML files with working navigation
4. Injects per-page SEO meta tags (title, description, canonical, Open Graph, Twitter Card, JSON-LD)
5. Downloads favicons, logos, and social icons locally
6. Generates sitemap.xml, robots.txt, and a custom 404 page
7. Deploys to GitHub Pages

Every link works. Every page is indexable. Every toggle and dropdown functions correctly. Preserving content, while saving lives and careers!

## 📊 SEO Strategy

Optimized to compete with established domains (`himsprogram.com`, `faa.gov`) for pilot-relevant search queries:

- **129+ unique pages** with individual canonical URLs, meta descriptions, and schema markup
- **6-hour content refresh cycle** signals freshness to search engines
- **Network cross-linking** distributes authority across all P4HR domains
- **Advocacy-angle content** that official sources don't provide (pilot stories, reform analysis, legal cases)
- **Long-tail keyword coverage** — from "FAA HIMS program requirements" to "PEth false positives pilots"

## 🛠️ Technical Details

| Component | Detail |
|-----------|--------|
| Generator | `scripts/mirror-p4hr.js` (Node.js) |
| CI/CD | GitHub Actions, every 6 hours |
| Hosting | GitHub Pages with custom domain |
| Source | pilotsforhimsreform.org (SPA → static HTML) |
| Pages | ~129 generated per build |
| Assets | Favicons, logos, social icons (local copies) |

## 📁 Repository Structure

```
himsprogram-info/
├── .github/workflows/mirror-p4hr.yml   # Build & deploy pipeline
├── scripts/mirror-p4hr.js              # Static site generator
├── images/                             # Favicons, logos, icons
├── index.html                          # Homepage
├── about.html ... wings-of-reform.html # ~127 content pages
├── 404.html                            # Custom not-found page
├── sitemap.xml                         # Auto-generated sitemap
├── robots.txt                          # Crawl directives
└── CNAME                               # Custom domain config
```

## 🚀 Replicating for Other Domains

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

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report issues or suggest improvements via GitHub Issues.

For security concerns: [SECURITY.md](SECURITY.md)

## 📜 License

[MIT](LICENSE)

## 🔗 Links

- **Main Site:** [pilotsforhimsreform.org](https://pilotsforhimsreform.org)
- **Community Forum:** [hims-victims.freeforums.net](https://hims-victims.freeforums.net)
- **This Site:** [himsprogram.info](https://himsprogram.info)

---

> *"I followed every rule. I never relapsed. But they treated me like I had no voice. Reform is not optional — it's overdue."*
> — Anonymous Pilot

---

**Pilots for HIMS Reform** — Transparency. Fairness. Accountability.
