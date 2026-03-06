#!/usr/bin/env node
/**
 * mirror-p4hr.js (v2 — full static site generator)
 *
 * Replaces the old mirror-p4hr.js + generate-seo.js.
 * Fetches pilotsforhimsreform.org SPA content and generates
 * complete static HTML pages with working navigation, SEO, and local assets.
 *
 * Environment:
 *   MIRROR_DOMAIN  (default: himsprogram.info)
 *   SOURCE_DOMAIN  (default: pilotsforhimsreform.org)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIRROR_DOMAIN = process.env.MIRROR_DOMAIN || 'himsprogram.info';
const SOURCE_DOMAIN = process.env.SOURCE_DOMAIN || 'pilotsforhimsreform.org';
const SOURCE_URL = `https://${SOURCE_DOMAIN}`;
const MIRROR_URL = `https://${MIRROR_DOMAIN}`;
const BUILD_NUMBER = process.env.GITHUB_RUN_NUMBER || '0';
const BUILD_TIME = new Date().toISOString();
const DISPLAY_TIME = new Date().toLocaleString('en-US', {
  timeZone: 'UTC', year:'numeric', month:'numeric', day:'numeric',
  hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
});
const FETCH_DELAY = 500;

console.log('═══════════════════════════════════════════════════════════');
console.log(`  P4HR Mirror Generator — ${MIRROR_DOMAIN}`);
console.log(`  Source: ${SOURCE_DOMAIN} | Build #${BUILD_NUMBER}`);
console.log(`  Time: ${DISPLAY_TIME} UTC`);
console.log('═══════════════════════════════════════════════════════════\n');

// ─── Utilities ──────────────────────────────────────────────────────────────

function fetchText(url, xhr = false) {
  const h = xhr ? '-H "X-Requested-With: XMLHttpRequest"' : '';
  try {
    return execSync(
      `curl -s -L --connect-timeout 20 --max-time 30 -A "Mozilla/5.0 (compatible; P4HRMirrorBot/1.0)" ${h} "${url}"`,
      { maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' }
    );
  } catch (e) { return null; }
}

function fetchBinary(url, dest) {
  try {
    execSync(`curl -s -L --connect-timeout 15 --max-time 20 -o "${dest}" "${url}"`);
    const stat = fs.statSync(dest);
    return stat.size > 0;
  } catch (e) { return false; }
}

function sleep(ms) { execSync(`sleep ${ms / 1000}`); }
function esc(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Download images, favicons, logos locally
// ═══════════════════════════════════════════════════════════════════════════

console.log('1. Downloading images & favicons...');
const imagesDir = path.join(process.cwd(), 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const ASSETS = [
  'P4HR-Newest-Logo-Medium.png',
  'fb.png',
  'x.jpg',
  'truthsocial.png',
  'favicon.ico',
  'favicon.svg',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
  'site.webmanifest',
];

for (const asset of ASSETS) {
  const dest = path.join(imagesDir, asset);
  // Only download if missing or older than 24 hours
  let needsDownload = true;
  if (fs.existsSync(dest)) {
    const age = Date.now() - fs.statSync(dest).mtimeMs;
    if (age < 24 * 60 * 60 * 1000) needsDownload = false;
  }
  if (needsDownload) {
    const ok = fetchBinary(`${SOURCE_URL}/images/${asset}`, dest);
    console.log(`   ${ok ? '✓' : '✗'} ${asset}`);
  } else {
    console.log(`   · ${asset} (cached)`);
  }
}

// Fix the web manifest to reference our local paths
const manifestPath = path.join(imagesDir, 'site.webmanifest');
if (fs.existsSync(manifestPath)) {
  try {
    let manifest = fs.readFileSync(manifestPath, 'utf-8');
    // Rewrite any absolute P4HR paths to local
    manifest = manifest.replace(/https?:\/\/pilotsforhimsreform\.org\/images\//g, '/images/');
    fs.writeFileSync(manifestPath, manifest);
    console.log('   ✓ site.webmanifest paths updated');
  } catch (e) { /* ignore */ }
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Fetch the SPA shell
// ═══════════════════════════════════════════════════════════════════════════

console.log('2. Fetching SPA shell...');
const shell = fetchText(SOURCE_URL);
if (!shell) { console.error('FATAL: Could not fetch shell'); process.exit(1); }
console.log(`   ✓ ${shell.length} bytes\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Extract PAGE_META (SEO titles + descriptions for every page)
// ═══════════════════════════════════════════════════════════════════════════

console.log('3. Extracting PAGE_META...');
const pageMeta = {};
const metaBlock = shell.match(/const PAGE_META\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (metaBlock) {
  const re = /'([^']+)':\s*\{\s*title:\s*'((?:[^'\\]|\\.)*)'\s*,\s*description:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  let m;
  while ((m = re.exec(metaBlock[1])) !== null) {
    pageMeta[m[1]] = {
      title: m[2].replace(/\\'/g, "'"),
      description: m[3].replace(/\\'/g, "'")
    };
  }
}
console.log(`   ✓ ${Object.keys(pageMeta).length} page meta entries\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Build the complete page list
// ═══════════════════════════════════════════════════════════════════════════

console.log('4. Building page list...');
const allPages = new Set();

// From navigation
const navRe = /loadPage\('([^']+)'\)/g;
let nm;
while ((nm = navRe.exec(shell)) !== null) allPages.add(nm[1]);

// From PAGE_META
Object.keys(pageMeta).forEach(p => allPages.add(p));

// Known extra pages referenced in homepage content
['emergency-toolkit.html', 'hims-voices-project.html', 'subscribe.html',
  'p4hr-act-2026.html', 'wings-of-reform-launch.html'].forEach(p => allPages.add(p));

// Remove externals and special pages
['donate.html'].forEach(p => allPages.delete(p));
[...allPages].filter(p => p.includes('://')).forEach(p => allPages.delete(p));

console.log(`   ✓ ${allPages.size} pages to generate\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: Prepare the shell template
// ═══════════════════════════════════════════════════════════════════════════

console.log('5. Preparing template...');

/**
 * Rewrite all internal links from SPA format to static file format.
 * Also rewrites image paths to local /images/ directory.
 */
function rewriteLinks(html) {
  let r = html;

  // Nav links: ?page=X.html → /X.html
  r = r.replace(/href="\?page=([^"]+)"/g, 'href="/$1"');

  // Remove SPA onclick handlers (href already works for navigation)
  r = r.replace(/ onclick="loadPage\('[^']+'\);\s*window\.history\.pushState\(\{\},\s*'',\s*'\?page=[^']+'\);\s*return false;"/g, '');

  // Images: /images/X → /images/X (keep local — they're downloaded)
  // No rewrite needed for /images/ since we download them locally.

  // Files (PDFs, etc.): /files/X → absolute P4HR URL (not mirrored)
  r = r.replace(/href="\/files\//g, `href="${SOURCE_URL}/files/`);
  // Also catch relative file links (no leading slash) in content fragments
  r = r.replace(/href="files\//g, `href="${SOURCE_URL}/files/`);

  // Remaining loadPage JS calls → direct navigation
  r = r.replace(/loadPage\('([^']+)'\)/g, "window.location.href='/$1'");

  // onclick ?page= → direct
  r = r.replace(/window\.location\.href='\?page=([^']*)'/g, "window.location.href='/$1'");

  // Any remaining href="?page=X" in content
  r = r.replace(/href="\?page=([^"]+)"/g, 'href="/$1"');

  return r;
}

// Split shell at the main-content boundary
const MC_TAG = '<div id="main-content">';
const mcIdx = shell.indexOf(MC_TAG);
if (mcIdx === -1) { console.error('FATAL: No main-content div found in shell'); process.exit(1); }
const mcEnd = mcIdx + MC_TAG.length;

// Shell BEFORE main-content: <html><head>...<body><nav>...<div id="main-content">
let shellBefore = rewriteLinks(shell.substring(0, mcEnd));

// Disable P4HR's Google Analytics (mirror should have its own or none)
shellBefore = shellBefore.replace(/G-WYLY7LQ0PE/g, 'G-MIRROR-DISABLED');

// Remove the original canonical (we inject per-page)
shellBefore = shellBefore.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/g, '');

// Shell AFTER content: extract real P4HR scripts + add network footer
const YEAR = new Date().getFullYear();

// Extract the actual P4HR JavaScript functions from the shell
// These include: toggleSection, toggleExpandCollapse, toggleThemeSwitch, openMenu, closeMenu
let p4hrScripts = '';
const scriptBlockMatch = shell.match(/function toggleSection[\s\S]*?<\/script>/);
if (scriptBlockMatch) {
  p4hrScripts = '<script>\n' + scriptBlockMatch[0];
  console.log('   ✓ Extracted P4HR scripts (toggleSection, toggleExpandCollapse, toggleThemeSwitch, openMenu, closeMenu)');
} else {
  console.warn('   ⚠ Could not extract P4HR scripts — toggles/dropdowns may not work');
}

// Also extract the bindTocToggle function if present
const tocMatch = shell.match(/function bindTocToggle[\s\S]*?<\/script>/);
if (tocMatch) {
  p4hrScripts += '\n<script>\n' + tocMatch[0];
}

const shellAfter = `
</div><!-- /main-content -->

<!-- P4HR Network Footer -->
<section style="background:#0d1b2a;color:#ccc;padding:50px 20px 30px;font-family:'Arimo',sans-serif;">
  <div style="max-width:1100px;margin:0 auto;">
    <h2 style="color:#fff;text-align:center;margin-bottom:10px;font-size:1.4rem;">Comprehensive HIMS Resource Network</h2>
    <p style="text-align:center;color:#aaa;margin-bottom:30px;font-size:0.95rem;">
      Complete ecosystem of pilot advocacy, community support, and reform resources.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-bottom:30px;">
      <a href="https://himsprogram.info" style="display:block;background:#162332;padding:18px;border-radius:8px;text-decoration:none;color:#fff;border:1px solid #2a3f55;">
        <strong style="display:block;margin-bottom:6px;">Program Information</strong>
        <small style="color:#8899aa;">Comprehensive FAA HIMS program details, requirements, and advocacy resources</small>
      </a>
      <a href="https://faahims.rehab" style="display:block;background:#162332;padding:18px;border-radius:8px;text-decoration:none;color:#fff;border:1px solid #2a3f55;">
        <strong style="display:block;margin-bottom:6px;">Community Forum</strong>
        <small style="color:#8899aa;">Active pilot community with 600+ members sharing real experiences and peer support</small>
      </a>
      <a href="https://faahimsprogram.com" style="display:block;background:#162332;padding:18px;border-radius:8px;text-decoration:none;color:#fff;border:1px solid #2a3f55;">
        <strong style="display:block;margin-bottom:6px;">Recovery Resources</strong>
        <small style="color:#8899aa;">Treatment facilities, success stories, and rehabilitation support for aviation professionals</small>
      </a>
      <a href="https://pilotsforhimsreform.org" style="display:block;background:#162332;padding:18px;border-radius:8px;text-decoration:none;color:#fff;border:1px solid #4a90d9;">
        <strong style="display:block;margin-bottom:6px;color:#7cb9ff;">★ Reform Advocacy (Main Site)</strong>
        <small style="color:#8899aa;">Official Pilots for HIMS Reform organization leading policy change efforts</small>
      </a>
    </div>
    <div style="display:flex;justify-content:center;gap:24px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="font-size:0.85rem;"><strong style="color:#4a90d9;">6 HR</strong> Update Frequency</span>
      <span style="font-size:0.85rem;"><strong style="color:#4a90d9;">600+</strong> Active Pilots</span>
      <span style="font-size:0.85rem;"><strong style="color:#4a90d9;">4</strong> Interconnected Sites</span>
      <span style="font-size:0.85rem;"><strong style="color:#4a90d9;">24/7</strong> Information Access</span>
    </div>
    <div style="text-align:center;padding-top:20px;border-top:1px solid #2a3f55;">
      <p style="font-size:0.8rem;color:#778;">
        © ${YEAR} Pilots for HIMS Reform. All rights reserved. |
        <a href="/terms.html" style="color:#4a90d9;">Terms</a> |
        <a href="/privacy.html" style="color:#4a90d9;">Privacy</a>
      </p>
      <p style="font-size:0.72rem;color:#556;margin-top:6px;">
        Not affiliated with the FAA or official HIMS Program. For educational purposes only.
      </p>
      <p style="font-size:0.68rem;color:#445;margin-top:6px;font-family:monospace;">
        Build #${BUILD_NUMBER} | ${DISPLAY_TIME} UTC | Next update in under 6 hours
      </p>
    </div>
  </div>
</section>

${p4hrScripts}

</body>
</html>`;

// Extract homepage content from the shell
// The shell structure: <div id="main-content">[homepage content]</div>[scripts]</body>
const bodyCloseIdx = shell.lastIndexOf('</body>');
const betweenMcAndBody = shell.substring(mcEnd, bodyCloseIdx);

// Find where homepage content ends and page-level scripts begin
let contentEndOffset = betweenMcAndBody.length;
const scriptRe = /\n<script>/g;
let scriptMatch;
while ((scriptMatch = scriptRe.exec(betweenMcAndBody)) !== null) {
  const context = betweenMcAndBody.substring(Math.max(0, scriptMatch.index - 200), scriptMatch.index);
  if (context.match(/<\/div>/g)?.length >= 2) {
    const lastDiv = betweenMcAndBody.lastIndexOf('</div>', scriptMatch.index);
    if (lastDiv > 0) { contentEndOffset = lastDiv + '</div>'.length; break; }
  }
}
const homepageContent = rewriteLinks(betweenMcAndBody.substring(0, contentEndOffset));

console.log(`   ✓ Template ready`);
console.log(`     Shell before: ${shellBefore.length} bytes`);
console.log(`     Shell after:  ${shellAfter.length} bytes`);
console.log(`     Homepage:     ${homepageContent.length} bytes\n`);

// ═══════════════════════════════════════════════════════════════════════════
// Page builder function
// ═══════════════════════════════════════════════════════════════════════════

function buildPage(pageName, content, meta) {
  const title = meta?.title || `${pageName.replace(/[-_]/g, ' ').replace('.html', '')} | FAA HIMS Program Info`;
  const desc = meta?.description || 'FAA HIMS program information and pilot advocacy resources.';
  const canonical = pageName === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${pageName}`;
  const p4hrLink = `${SOURCE_URL}/?page=${pageName}`;

  // SEO meta block
  const seo = `
    <!-- Mirror SEO: ${MIRROR_DOMAIN} -->
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}"/>
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"/>
    <link rel="canonical" href="${canonical}"/>
    <meta property="og:title" content="${esc(title)}"/>
    <meta property="og:description" content="${esc(desc)}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:url" content="${canonical}"/>
    <meta property="og:site_name" content="FAA HIMS Program Info — ${MIRROR_DOMAIN}"/>
    <meta property="og:updated_time" content="${BUILD_TIME}"/>
    <meta name="twitter:card" content="summary"/>
    <meta name="twitter:title" content="${esc(title)}"/>
    <meta name="twitter:description" content="${esc(desc)}"/>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebPage","name":${JSON.stringify(title)},"description":${JSON.stringify(desc)},"url":"${canonical}","dateModified":"${BUILD_TIME}","isPartOf":{"@type":"WebSite","name":"FAA HIMS Program Information","url":"${MIRROR_URL}"}}
    </script>`;

  // Mirror identification banner
  const banner = `<div id="mirror-banner" style="background:linear-gradient(135deg,#1a3a5c,#2563eb);color:#fff;text-align:center;padding:8px 16px;font-size:0.82rem;font-family:'Arimo',sans-serif;position:sticky;top:0;z-index:10000;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
    <strong>FAA HIMS Program Information</strong> — A
    <a href="${SOURCE_URL}" style="color:#a5d8ff;text-decoration:underline;">Pilots for HIMS Reform</a> network site
    <span style="margin-left:8px;">|</span>
    <a href="${p4hrLink}" style="color:#a5d8ff;text-decoration:underline;margin-left:8px;">View on main site →</a>
  </div>`;

  // Start with the shell (head + nav)
  let head = shellBefore;

  // Strip original meta tags that we're replacing
  head = head.replace(/<title>[^<]*<\/title>/g, '');
  head = head.replace(/<meta\s+content="[^"]*"\s+property="og:title"\s*\/?\s*>/g, '');
  head = head.replace(/<meta\s+content="[^"]*"\s+property="og:description"\s*\/?\s*>/g, '');
  head = head.replace(/<meta\s+content="[^"]*"\s+property="og:url"\s*\/?\s*>/g, '');
  head = head.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/g, '');
  head = head.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/g, '');
  head = head.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/g, '');
  head = head.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/g, '');

  // Inject our SEO block after <meta charset>
  const charsetPos = head.indexOf('<meta charset');
  if (charsetPos > 0) {
    const afterCharset = head.indexOf('/>', charsetPos);
    if (afterCharset > 0) {
      head = head.substring(0, afterCharset + 2) + seo + head.substring(afterCharset + 2);
    }
  } else {
    head = head.replace(/<head([^>]*)>/, (match) => match + seo);
  }

  // Inject banner after <body>
  const bodyMatch = head.match(/<body[^>]*>/);
  if (bodyMatch) {
    const bodyEnd = head.indexOf(bodyMatch[0]) + bodyMatch[0].length;
    head = head.substring(0, bodyEnd) + '\n' + banner + '\n' + head.substring(bodyEnd);
  }

  // Rewrite the content links
  const rewrittenContent = rewriteLinks(content);

  return `${head}\n${rewrittenContent}\n${shellAfter}\n<!-- Build #${BUILD_NUMBER} | ${MIRROR_DOMAIN} | ${BUILD_TIME} -->`;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6: Generate index.html (homepage)
// ═══════════════════════════════════════════════════════════════════════════

console.log('6. Generating index.html...');
const indexMeta = {
  title: `FAA HIMS Program Information & Reform | ${MIRROR_DOMAIN} — Advocacy Resource ${YEAR}`,
  description: 'Independent FAA HIMS program information center. Pilot medical certification, HIMS requirements, reform advocacy. A Pilots for HIMS Reform network resource.'
};
const indexHtml = buildPage('index.html', homepageContent, indexMeta);
fs.writeFileSync('index.html', indexHtml);
console.log(`   ✓ index.html (${(indexHtml.length / 1024).toFixed(0)}K)\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7: Generate all content pages
// ═══════════════════════════════════════════════════════════════════════════

console.log(`7. Generating ${allPages.size} content pages...\n`);
let okCount = 0, failCount = 0;
const generated = ['index.html'];
const sortedPages = [...allPages].sort();

for (let i = 0; i < sortedPages.length; i++) {
  const pageName = sortedPages[i];
  if (pageName === 'index.html') continue;

  const shortName = pageName.length > 55 ? pageName.substring(0, 52) + '...' : pageName;
  process.stdout.write(`   [${i + 1}/${sortedPages.length}] ${shortName} `);

  const content = fetchText(`${SOURCE_URL}/${pageName}`, true);

  // Validate the response
  if (!content || content.length < 50) {
    console.log('✗ empty'); failCount++; sleep(FETCH_DELAY); continue;
  }
  if (content.includes('404: Page not found') && content.length < 500) {
    console.log('✗ 404'); failCount++; sleep(FETCH_DELAY); continue;
  }

  // Some pages return full HTML documents instead of fragments
  // Extract the <body> content in that case
  let pageContent = content;
  if (content.trimStart().startsWith('<!DOCTYPE') || content.trimStart().startsWith('<!doctype') ||
      content.trimStart().startsWith('<html')) {
    const bodyStart = content.indexOf('<body');
    const bodyTagEnd = bodyStart > -1 ? content.indexOf('>', bodyStart) + 1 : -1;
    const bodyClose = content.lastIndexOf('</body>');
    if (bodyTagEnd > 0 && bodyClose > bodyTagEnd) {
      pageContent = content.substring(bodyTagEnd, bodyClose);
      console.log(`(full-page→extracted) `);
    } else {
      console.log('⚠ full-page, could not extract body'); failCount++; sleep(FETCH_DELAY); continue;
    }
  }

  // Get SEO meta (from P4HR's PAGE_META or generate fallback)
  const meta = pageMeta[pageName] || {
    title: `${pageName.replace(/[-_]/g, ' ').replace('.html', '')} | FAA HIMS Program Information`,
    description: `FAA HIMS program information — ${pageName.replace('.html', '')}.`
  };

  const html = buildPage(pageName, pageContent, meta);
  fs.writeFileSync(pageName, html);
  generated.push(pageName);
  okCount++;
  console.log(`✓ (${(html.length / 1024).toFixed(0)}K)`);
  sleep(FETCH_DELAY);
}
console.log(`\n   Result: ${okCount} generated, ${failCount} failed\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 8: Generate 404.html
// ═══════════════════════════════════════════════════════════════════════════

console.log('8. Generating 404.html...');
const notFoundContent = `
<section style="text-align:center;padding:80px 20px;font-family:'Arimo',sans-serif;">
  <h1 style="font-size:4rem;color:#e74c3c;margin-bottom:0;">404</h1>
  <h2 style="margin-top:8px;">Page Not Found</h2>
  <p style="font-size:1.1rem;color:#666;max-width:600px;margin:20px auto;">
    This page doesn't exist on this mirror. Try the
    <a href="${SOURCE_URL}">main Pilots for HIMS Reform site</a>.
  </p>
  <div style="margin-top:30px;">
    <a href="/" style="display:inline-block;padding:14px 28px;background:#1a3a5c;color:#fff;border-radius:6px;text-decoration:none;margin:8px;font-weight:600;">← Home</a>
    <a href="${SOURCE_URL}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;margin:8px;font-weight:600;">Visit Main Site →</a>
  </div>
  <div style="margin-top:40px;">
    <h3>Popular Pages</h3>
    <p>
      <a href="/faq.html">FAQ</a> ·
      <a href="/about.html">About</a> ·
      <a href="/entering-hims.html">New Pilot Guide</a> ·
      <a href="/emergency-toolkit.html">Emergency Toolkit</a> ·
      <a href="/stories.html">Stories</a> ·
      <a href="/news.html">News</a>
    </p>
  </div>
</section>`;
const nfHtml = buildPage('404.html', notFoundContent, {
  title: 'Page Not Found | FAA HIMS Program Information',
  description: 'The requested page was not found.'
});
fs.writeFileSync('404.html', nfHtml);
generated.push('404.html');
console.log('   ✓ 404.html\n');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 9: Generate sitemap.xml
// ═══════════════════════════════════════════════════════════════════════════

console.log('9. Generating sitemap.xml...');
const today = BUILD_TIME.split('T')[0];
const highPri = new Set(['index.html', 'faq.html', 'about.html', 'entering-hims.html',
  'emergency-toolkit.html', 'stories.html', 'faa-hims-program.html', 'aeropath.html', 'news.html']);
const medPri = new Set(['legal.html', 'p4hr-act-2026.html', 'policy-reform.html', 'contact.html',
  'our-team.html', 'resources.html', 'toolkit.html', 'testimonials.html', 'mission-vision.html']);

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${generated.filter(p => p !== '404.html').map(p => {
    const loc = p === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${p}`;
    const pri = p === 'index.html' ? '1.0' : highPri.has(p) ? '0.9' : medPri.has(p) ? '0.8' : '0.6';
    return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${pri}</priority></url>`;
  }).join('\n')}
</urlset>`;
fs.writeFileSync('sitemap.xml', sitemapXml);
console.log(`   ✓ sitemap.xml (${generated.length - 1} URLs)\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 10: Generate robots.txt
// ═══════════════════════════════════════════════════════════════════════════

console.log('10. Generating robots.txt...');
fs.writeFileSync('robots.txt',
  `# ${MIRROR_DOMAIN} — Pilots for HIMS Reform network\n# Generated: ${BUILD_TIME}\n\nUser-agent: *\nAllow: /\nDisallow: /.github/\nDisallow: /scripts/\nDisallow: /node_modules/\n\nSitemap: ${MIRROR_URL}/sitemap.xml\n\nUser-agent: Googlebot\nCrawl-delay: 1\n\nUser-agent: Bingbot\nCrawl-delay: 2\n`
);
console.log('   ✓ robots.txt\n');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 11: Write CNAME
// ═══════════════════════════════════════════════════════════════════════════

fs.writeFileSync('CNAME', MIRROR_DOMAIN);
console.log(`11. CNAME → ${MIRROR_DOMAIN}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// DONE
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════');
console.log(`  BUILD COMPLETE — ${MIRROR_DOMAIN}`);
console.log(`  Pages:  ${generated.length} (${failCount} failed)`);
console.log(`  Assets: ${ASSETS.length} images/favicons`);
console.log(`  Build:  #${BUILD_NUMBER} at ${DISPLAY_TIME} UTC`);
console.log('═══════════════════════════════════════════════════════════');
