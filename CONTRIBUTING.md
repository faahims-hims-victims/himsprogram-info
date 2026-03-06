# Contributing to himsprogram.info

Thank you for your interest in contributing to the himsprogram.info mirror site — part of the [Pilots for HIMS Reform](https://pilotsforhimsreform.org) network.

## How This Site Works

This is an **automated static mirror** of pilotsforhimsreform.org. Content is generated every 6 hours by `scripts/mirror-p4hr.js` via GitHub Actions. The script fetches the main site's SPA shell and content fragments, then produces standalone, SEO-optimized HTML pages deployed to GitHub Pages.

Because of this architecture, **content changes should be made on the main site (pilotsforhimsreform.org), not here.** Changes pushed to the main site will automatically propagate to this mirror within 6 hours, or immediately if a manual build is triggered.

## What You Can Contribute Here

Contributions to this repository should focus on the **mirror infrastructure**, not content:

- **Build script improvements** — Bug fixes, performance improvements, or better error handling in `scripts/mirror-p4hr.js`
- **SEO enhancements** — Improved meta tags, schema markup, sitemap generation, or search engine optimization
- **Accessibility fixes** — ARIA labels, semantic HTML improvements, or screen reader compatibility in the generated pages
- **CI/CD improvements** — Workflow reliability, caching, deployment optimizations
- **Documentation** — README, CONTRIBUTING, SECURITY, or other repository documentation
- **Bug reports** — Broken links, missing pages, rendering issues, or asset download failures

## How to Contribute

### Reporting Issues

1. Check [existing issues](https://github.com/faahims-hims-victims/himsprogram-info/issues) first to avoid duplicates
2. Open a new issue with a clear title and description
3. For rendering bugs, include the affected page URL and a screenshot if possible
4. For build failures, include the relevant GitHub Actions log output

### Submitting Changes

1. Fork the repository
2. Create a feature branch from `main` (`git checkout -b fix/description`)
3. Make your changes
4. Test locally if possible: `MIRROR_DOMAIN=himsprogram.info node scripts/mirror-p4hr.js`
5. Commit with a clear message describing the change
6. Open a Pull Request against `main`

### Testing Locally

```bash
git clone https://github.com/faahims-hims-victims/himsprogram-info.git
cd himsprogram-info
npm install  # if package.json has dependencies
MIRROR_DOMAIN=himsprogram.info node scripts/mirror-p4hr.js
# Open index.html in a browser to verify
```

Note: The script fetches live content from pilotsforhimsreform.org, so you need an internet connection to test.

## Content Contributions

If you want to contribute **content** — pilot stories, reform analysis, legal research, or corrections to existing pages — please contribute directly to the main site:

- **Email:** Contact Pilots for HIMS Reform through [pilotsforhimsreform.org/contact](https://pilotsforhimsreform.org/?page=contact.html)
- **Stories:** Submit your experience through the [HIMS Voices Project](https://pilotsforhimsreform.org/hims-voices-project.html)
- **Forum:** Join the community at [hims-victims.freeforums.net](https://hims-victims.freeforums.net)

## Guidelines

- **Do not commit secrets** — API keys, credentials, or personal information should never appear in commits
- **Respect the mission** — This project exists to support aviation professionals navigating the HIMS system. Contributions should align with that purpose
- **Test before submitting** — Run the build script locally to verify your changes don't break page generation
- **Keep it simple** — The mirror script is intentionally straightforward. Avoid introducing unnecessary dependencies or complexity

## Review Process

All Pull Requests are reviewed by project maintainers. We aim to respond within a few days, but this is a volunteer-run project, so please be patient. Maintainers may request changes or suggest alternative approaches before merging.

## Code of Conduct

We expect all contributors to treat each other with respect and professionalism. This project serves a community of aviation professionals — many of whom are in vulnerable situations. Harassment, discrimination, or bad-faith contributions will not be tolerated.

Instances of unacceptable behavior may be reported to the project maintainers via [GitHub Issues](https://github.com/faahims-hims-victims/himsprogram-info/issues) or through the [P4HR contact page](https://pilotsforhimsreform.org/?page=contact.html).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
