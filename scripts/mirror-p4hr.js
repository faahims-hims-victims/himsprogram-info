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
  const xc = xhr ? '-H "X-Requested-With: XMLHttpRequest"' : '';
  const xw = xhr ? '--header="X-Requested-With: XMLHttpRequest"' : '';
  const methods = [
    { cmd: `curl -s -L --connect-timeout 10 --max-time 20 ${xc} "${url}"`, label: 'curl default' },
    { cmd: `wget -q -O - --timeout=20 ${xw} "${url}"`, label: 'wget' },
    { cmd: `curl -s -L --connect-timeout 10 --max-time 20 --http1.1 -A "" ${xc} "${url}"`, label: 'curl h1.1+noUA' },
    { cmd: `curl -s -L --connect-timeout 10 --max-time 20 -x "http://pubproxy.com/api/proxy?format=txt&type=http" ${xc} "${url}"`, label: 'curl pubproxy' },
    { cmd: `curl -s -L --connect-timeout 10 --max-time 25 -x "https://corsproxy.io/?${encodeURIComponent(url)}" "${url}"`, label: 'curl corsproxy' },
    { cmd: `wget -q -O - --timeout=20 "https://api.allorigins.win/raw?url=${encodeURIComponent(url)}"`, label: 'wget allorigins' },
  ];
  for (let i = 0; i < methods.length; i++) {
    try {
      const result = execSync(methods[i].cmd, { maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8', timeout: 30000 });
      if (result && result.length > 200) {
        if (i > 0) console.log(`   (fetch ok via ${methods[i].label})`);
        return result;
      }
    } catch (e) { /* try next */ }
    if (i < methods.length - 1) sleep(2000);
  }
  return null;
}

function fetchBinary(url, dest) {
  try {
    execSync(`curl -s -L --connect-timeout 15 --max-time 30 -o "${dest}" "${url}"`);
    const stat = fs.statSync(dest);
    return stat.size > 0;
  } catch (e) { return false; }
}

function sleep(ms) { execSync(`sleep ${ms / 1000}`); }
function esc(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/**
 * FIX 3 — Strip embedded <head> blocks from page content.
 * Preserves page-specific <style> rules (FAQ accordion, etc.) while
 * removing body/html/container-level CSS that conflicts with mirror shell.
 */
function cleanPageContent(raw, pageName) {
  let content = raw;
  const trimmed = content.trimStart();
  const isFullDoc = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<html') || trimmed.startsWith('<head');
  const hasEmbeddedHead = content.includes('<head>') || content.includes('<head ');

  if (!isFullDoc && !hasEmbeddedHead) return content;

  // Extract page-specific <style> blocks, strip conflicting rules
  const styleBlocks = content.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  let cleanedStyles = styleBlocks.map(function(block) {
    return block
      .replace(/\bbody\s*\{[^}]*\}/g, '/* body rules stripped by mirror */')
      .replace(/\bhtml\s*\{[^}]*\}/g, '/* html rules stripped by mirror */')
      .replace(/\.container\s*\{[^}]*\}/g, '/* container rules stripped by mirror */');
  }).join('\n');

  if (isFullDoc) {
    var bodyStart = content.indexOf('<body');
    var bodyTagEnd = bodyStart > -1 ? content.indexOf('>', bodyStart) + 1 : -1;
    var bodyClose = content.lastIndexOf('</body>');
    if (bodyTagEnd > 0 && bodyClose > bodyTagEnd) {
      content = content.substring(bodyTagEnd, bodyClose);
    } else {
      content = content.replace(/<head[\s\S]*?<\/head>/gi, '');
      content = content.replace(/<\/?html[^>]*>/gi, '');
      content = content.replace(/<\/?body[^>]*>/gi, '');
      content = content.replace(/^<!(DOCTYPE|doctype)[^>]*>/m, '');
    }
    console.log('(full-doc cleaned) ');
  }

  // Strip remaining <head> sections and embedded GA tracking
  content = content.replace(/<head[\s\S]*?<\/head>/gi, '');
  content = content.replace(/<script[^>]*src="[^"]*googletagmanager[^"]*"[^>]*><\/script>/gi, '');
  content = content.replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/gi, '');

  // Re-inject cleaned page styles
  if (cleanedStyles.trim().length > 50) {
    content = cleanedStyles + '\n' + content;
  }
  return content;
}

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
    const stat = fs.statSync(dest);
    const age = Date.now() - stat.mtimeMs;
    if (age < 24 * 60 * 60 * 1000 && stat.size > 100) needsDownload = false;
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
if (!shell) {
  try {
    const dbg = execSync(`curl -v -L --connect-timeout 20 --max-time 30 -A "" "https://pilotsforhimsreform.org" 2>&1 | head -50`, { encoding: 'utf-8', maxBuffer: 5*1024*1024 });
    console.log('DEBUG curl output:\n' + dbg);
  } catch(e) { console.log('DEBUG error: ' + e.message); }
  console.error('FATAL: Could not fetch shell'); process.exit(1);
}

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
  'p4hr-act-2026.html', 'wings-of-reform-launch.html',
  'bio-mike-danford.html', 'bio-maurice-macewen.html', 'bio-diego-garcia.html'
].forEach(p => allPages.add(p));

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

   // Content images not in our local /images/ set → absolute P4HR URL
  r = r.replace(/src="images\//g, `src="${SOURCE_URL}/images/`);
  r = r.replace(/src="\/images\/(?!P4HR-Newest|fb\.|x\.|truthsocial|favicon|apple-touch|web-app|site\.web)/g, `src="${SOURCE_URL}/images/`);
  
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

// ─── Strip P4HR duplicate meta tags that conflict with per-page SEO ──────
shellBefore = shellBefore.replace(/<meta\s+content="[^"]*"\s+name="description"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+content="[^"]*"\s+name="keywords"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+content="[^"]*"\s+name="author"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+content="[^"]*"\s+property="og:image"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+content="[^"]*"\s+property="og:type"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+content="[^"]*"\s+property="og:locale"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<script type="application\/ld\+json">\s*\{[^}]*"@type"\s*:\s*"Organization"[\s\S]*?<\/script>/g, '');
shellBefore = shellBefore.replace(/<script type="application\/ld\+json">\s*\{[^}]*"@type"\s*:\s*"WebSite"[\s\S]*?<\/script>/g, '');
shellBefore = shellBefore.replace(/\n{3,}/g, '\n\n');

// ─── Inject CSS for fixed resource network panel (CSS-only, no DOM changes) ─
const mirrorCSS = `
<style id="mirror-enhancements">
  /* FIX 1: Hamburger + close buttons above the mirror banner */
  #hamburger-toggle,
  #close-menu-toggle {
    z-index: 10001 !important;
    top: 52px !important;
  }
  /* Fixed resource network panel — right side, doesn't scroll with content */
  #mirror-resource-network {
    position: fixed;
    top: 48px;
    right: 0;
    width: 320px;
    bottom: 0;
    overflow-y: auto;
    z-index: 9000;
    scrollbar-width: thin;
    scrollbar-color: #2a3f55 transparent;
  }
  #mirror-resource-network::-webkit-scrollbar { width: 5px; }
  #mirror-resource-network::-webkit-scrollbar-track { background: transparent; }
  #mirror-resource-network::-webkit-scrollbar-thumb { background: #2a3f55; border-radius: 3px; }

  /* Constrain entire layout to leave room for the fixed panel */
  .container {
    width: calc(100vw - 320px) !important;
    max-width: calc(100vw - 320px) !important;
  }
  body {
    overflow-x: hidden;
  }
  main {
    max-width: 100% !important;
    overflow-x: hidden !important;
  }
  /* FIX 4: Prevent content from running under resource panel */
  #main-content {
    max-width: 100% !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    padding-right: 16px !important;
  }
  #main-content > * {
    max-width: 100% !important;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
  }
  /* Force page-level footers to flow normally (not float/overlap) */
  #main-content footer {
    clear: both !important;
    float: none !important;
    position: static !important;
    width: 100% !important;
  }

  /* Resource card styles */
  .rn-card {
    display: block;
    background: #162332;
    padding: 12px 14px;
    border-radius: 8px;
    text-decoration: none;
    color: #fff;
    border: 1px solid #2a3f55;
    transition: transform 0.2s ease, border-color 0.2s ease;
    margin-bottom: 8px;
  }
  .rn-card:hover {
    transform: translateY(-2px);
    border-color: #4a90d9;
  }
  .rn-card strong { display: block; margin-bottom: 3px; font-size: 0.88rem; }
  .rn-card small  { color: #8899aa; font-size: 0.78rem; line-height: 1.3; }
  .rn-card--active {
    border-color: #4a90d9;
    background: #1a2d42;
  }
  .rn-card--active strong { color: #7cb9ff; }

  /* Responsive: collapse panel below 1080px */
  @media (max-width: 1080px) {
    #mirror-resource-network {
      position: static;
      width: 100%;
      max-height: unset;
      overflow-y: visible;
    }
    .container {
      width: 100% !important;
      max-width: 100% !important;
    }
    #main-content {
      padding-right: 0 !important;
    }
  }

  /* Push page TOC sidebars left of the resource network panel */
  #toc-sidebar {
    right: 340px !important;
  }
  button#toc-toggle,
  button[onclick*="toc-sidebar"],
  button[style*="position:fixed"][style*="right:20px"] {
    right: 340px !important;
  }
  @media (max-width: 1080px) {
    #toc-sidebar {
      right: 20px !important;
    }
    button#toc-toggle,
    button[onclick*="toc-sidebar"] {
      right: 20px !important;
    }
  }

  /* Mobile: hide panel entirely (nav sidebar takes priority) */
  @media (max-width: 768px) {
    #mirror-resource-network {
      display: none;
    }
  }
</style>`;
shellBefore = shellBefore.replace('</head>', mirrorCSS + '\n</head>');

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

<!-- ═══ Fixed Resource Network Panel (CSS position:fixed, no DOM restructuring) ═══ -->
<div id="mirror-resource-network">
  <div style="background:#0d1b2a;color:#ccc;padding:20px 16px;font-family:'Arimo',sans-serif;min-height:100%;">
    <h2 style="color:#fff;text-align:center;margin:0 0 6px;font-size:1.1rem;font-weight:700;">Comprehensive HIMS Resource Network</h2>
    <p style="text-align:center;color:#aaa;margin:0 0 16px;font-size:0.8rem;line-height:1.3;">
      Complete ecosystem of pilot advocacy, community support, and reform resources.
    </p>

    <a class="rn-card rn-card--active" href="/">
      <strong>Program Information</strong>
      <small>Comprehensive FAA HIMS program details, requirements, and advocacy resources</small>
    </a>
    <a class="rn-card" href="https://faahims.rehab">
      <strong>Community Forum</strong>
      <small>Active pilot community with 600+ members sharing real experiences and peer support</small>
    </a>
    <a class="rn-card" href="https://faahimsprogram.com">
      <strong>Recovery Resources</strong>
      <small>Treatment facilities, success stories, and rehabilitation support for aviation professionals</small>
    </a>
    <a class="rn-card" href="https://aeromedicalcompass.org">
      <strong>Aeromedical Compass</strong>
      <small>Independent AME directory and aeromedical guidance for pilots and controllers</small>
    </a>
    <a class="rn-card" href="https://pilotsforhimsreform.org">
      <strong style="color:#7cb9ff;">★ Reform Advocacy (Main Site)</strong>
      <small>Official Pilots for HIMS Reform organization leading policy change efforts</small>
    </a>

    <div style="text-align:center;margin-top:16px;font-size:0.75rem;">
      <div style="margin-bottom:6px;">
        <strong style="color:#4a90d9;">6 HR</strong> Update Frequency &nbsp;·&nbsp;
        <strong style="color:#4a90d9;">600+</strong> Active Pilots
      </div>
      <div>
        <strong style="color:#4a90d9;">5</strong> Interconnected Sites &nbsp;·&nbsp;
        <strong style="color:#4a90d9;">24/7</strong> Information Access
      </div>
    </div>

    <div style="text-align:center;padding-top:16px;margin-top:16px;border-top:1px solid #2a3f55;">
      <p style="font-size:0.75rem;color:#778;margin:0 0 4px;">
        &copy; ${YEAR} Pilots for HIMS Reform. All rights reserved. |
        <a href="${SOURCE_URL}/?page=terms.html" style="color:#4a90d9;">Terms</a> |
        <a href="${SOURCE_URL}/?page=privacy.html" style="color:#4a90d9;">Privacy</a>
      </p>
      <p style="font-size:0.68rem;color:#556;margin:0 0 4px;">
        Not affiliated with the FAA or official HIMS Program.
      </p>
      <p style="font-size:0.64rem;color:#445;margin:0;font-family:monospace;">
        Build #${BUILD_NUMBER} | ${DISPLAY_TIME} UTC
      </p>
    </div>
  </div>
</div>

${p4hrScripts}

<script>
// FIX 2: Close mobile nav sidebar after selecting a link
document.addEventListener('click', function(e) {
  var link = e.target.closest('aside a');
  if (!link) return;
  var href = link.getAttribute('href');
  if (href && href !== '#' && !href.startsWith('javascript:')) {
    var aside = document.querySelector('aside');
    if (aside && aside.classList.contains('active')) {
      aside.classList.remove('active');
      document.body.classList.remove('menu-open');
      var h = document.getElementById('hamburger-toggle');
      var c = document.getElementById('close-menu-toggle');
      if (h) h.style.display = 'flex';
      if (c) c.style.display = 'none';
    }
  }
});

// Also close on sub-nav link clicks (handles onclick handlers)
document.addEventListener('DOMContentLoaded', function() {
  var subLinks = document.querySelectorAll('aside nav ul li ul li a');
  subLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      var aside = document.querySelector('aside');
      if (aside) {
        aside.classList.remove('active');
        document.body.classList.remove('menu-open');
        var h = document.getElementById('hamburger-toggle');
        var c = document.getElementById('close-menu-toggle');
        if (h) h.style.display = 'flex';
        if (c) c.style.display = 'none';
      }
    });
  });
});
</script>

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
let homepageContent = rewriteLinks(betweenMcAndBody.substring(0, contentEndOffset));

// Fix network stats pulled from main site
homepageContent = homepageContent.replace(
  /<strong[^>]*>4<\/strong> Interconnected Sites/,
  '<strong style="color:#4a90d9;">5</strong> Interconnected Sites'
);
homepageContent = homepageContent.replace(
  /<strong[^>]*>600\+<\/strong> Active Pilots/,
  '<strong style="color:#4a90d9;">600+</strong> Active Members'
);
homepageContent = homepageContent.replace(
  /Information Access/,
  'Real-Time Intelligence'
);
homepageContent = homepageContent.replace(
  /Fresh content every 6 hours[^<]*/,
  'Real-time legal case tracking | Active airline monitoring | Exposed HIMS program data | Community-driven intelligence'
);

// Inject Aeromedical Compass into the main-site network grid
homepageContent = homepageContent.replace(
  /<a[^>]*href="https:\/\/pilotsforhimsreform\.org"[^>]*>\s*<[^>]*>★ Reform Advocacy/,
  `<a href="https://aeromedicalcompass.org" style="display:block;background:#162332;padding:18px;border-radius:8px;text-decoration:none;color:#fff;border:1px solid #2a3f55;">
        <strong style="display:block;margin-bottom:6px;">Aeromedical Compass</strong>
        <small style="color:#8899aa;">Independent AME directory and aeromedical guidance for pilots and controllers</small>
      </a>
      <a href="https://pilotsforhimsreform.org" style="display:block;background:#162332;padding:18px;border-radius:8px;text-decoration:none;color:#fff;border:1px solid #4a90d9;">
        <strong style="display:block;margin-bottom:6px;color:#7cb9ff;">★ Reform Advocacy`
);

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
// FIX 3: Clean page content — strip embedded <head>, conflicting CSS
  let pageContent = cleanPageContent(content, pageName);

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
// STEP 11: Write CNAME & IndexNow key
// ═══════════════════════════════════════════════════════════════════════════

fs.writeFileSync('CNAME', MIRROR_DOMAIN);
console.log(`11. CNAME → ${MIRROR_DOMAIN}`);

// IndexNow verification key file
fs.writeFileSync('79cfaa07ffd0a57d6d8add4207f5d8bd.txt', '79cfaa07ffd0a57d6d8add4207f5d8bd\n');
console.log('    IndexNow key file written\n');

// ═══════════════════════════════════════════════════════════════════════════
// DONE
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════');
console.log(`  BUILD COMPLETE — ${MIRROR_DOMAIN}`);
console.log(`  Pages:  ${generated.length} (${failCount} failed)`);
console.log(`  Assets: ${ASSETS.length} images/favicons`);
console.log(`  Build:  #${BUILD_NUMBER} at ${DISPLAY_TIME} UTC`);
console.log('═══════════════════════════════════════════════════════════');
