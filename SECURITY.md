# Security Policy — himsprogram.info

## Overview

himsprogram.info is a **static mirror site** generated every 6 hours from [pilotsforhimsreform.org](https://pilotsforhimsreform.org) and deployed via GitHub Pages. It has no backend, no database, no user authentication, and collects no personally identifiable information. The attack surface is limited to the build pipeline and the static content it produces.

This site is part of the [Pilots for HIMS Reform](https://pilotsforhimsreform.org) network, which serves aviation professionals — many of whom face career-threatening consequences for seeking help. Security and privacy are taken seriously.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, report security concerns privately:

- **Email:** Contact maintainers through the [P4HR contact page](https://pilotsforhimsreform.org/?page=contact.html) with "SECURITY" in the subject line
- **Response time:** We aim to acknowledge reports within 48 hours and provide a substantive response within 7 days

Please include:

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Affected component (build script, workflow, generated pages, DNS/hosting)
- Potential impact

## Scope

### In Scope

Security issues affecting:

- **Build pipeline** — `scripts/mirror-p4hr.js` and `.github/workflows/mirror-p4hr.yml`
- **Generated content** — XSS, injection, or malicious content in output HTML
- **GitHub Actions workflow** — Secret exposure, privilege escalation, supply chain risks
- **DNS and hosting** — Domain hijacking, SSL/TLS configuration, CNAME misconfiguration
- **Dependency vulnerabilities** — Issues in `package.json` dependencies
- **Content integrity** — Unauthorized modification of mirrored content

### Out of Scope

The following are outside this repository's control:

- **pilotsforhimsreform.org** (source site) — Report directly to P4HR maintainers
- **faahims.rehab, faahimsprogram.com, aeromedicalcompass.org** — Report to their respective maintainers
- **hims-victims.freeforums.net** — Hosted by ProBoards; report to their support
- **GitHub platform vulnerabilities** — Report to [GitHub Security](https://github.com/security)
- **Third-party CDNs** — Cloudflare, npm, etc.
- **Denial of service attacks** — Static site hosted on GitHub Pages CDN
- **Social engineering** — Attacks targeting maintainers personally

## Security Architecture

### What This Site Does

- Fetches public HTML content from pilotsforhimsreform.org via `curl`/`wget`
- Downloads image assets (logos, favicons, social icons)
- Generates static HTML files with SEO meta tags
- Commits generated files to the repository
- Deploys to GitHub Pages

### What This Site Does Not Do

- Accept user input of any kind
- Store or process personal data
- Use cookies, local storage, or session tracking
- Run server-side code
- Authenticate users
- Connect to any database

### Build Environment

- Runs on GitHub-hosted Ubuntu runners
- Node.js 20.x
- No secrets beyond GitHub's built-in `GITHUB_TOKEN` for push access
- No external API keys or credentials required

## Disclosure Policy

We follow responsible disclosure practices:

1. **Acknowledgment** — We acknowledge your report within 48 hours
2. **Assessment** — We assess severity and determine a fix timeline
3. **Fix** — Patches deploy automatically within the next 6-hour build cycle, or immediately via manual workflow trigger
4. **Credit** — With your permission, we credit reporters in commit messages or release notes
5. **Disclosure** — After the fix is deployed, we may document the issue in commit history

## Known Considerations

We are transparent about the following:

1. **Public source content** — All mirrored content originates from a publicly accessible website. The mirror does not expose anything not already public.
2. **No PII collection** — This site intentionally collects no personal information. The subscribe form on mirrored pages submits to the main site, not to this mirror.
3. **Build logs are public** — GitHub Actions logs for this repository are visible. The build script does not handle secrets, but contributors should verify no sensitive information leaks into logs.
4. **Image caching** — Downloaded assets are cached in the repository for 24 hours. A compromised source image could persist until the next cache refresh. The build script validates file sizes to mitigate zero-byte or corrupted downloads.
5. **Fetch fallback chain** — The build script tries multiple HTTP methods (curl, wget) to reach the source site. Public proxy services are included as fallbacks. These proxies see the request URL but not any sensitive data (there is none).

## Dependencies

This project has minimal dependencies:

- **Node.js** — Runtime for the build script
- **curl / wget** — HTTP clients (system-installed on GitHub Actions runners)
- No npm runtime dependencies are required for the build script itself

## Contact

For security matters: [P4HR contact page](https://pilotsforhimsreform.org/?page=contact.html) with "SECURITY" in the subject line.

For general issues: [GitHub Issues](https://github.com/faahims-hims-victims/himsprogram-info/issues)
