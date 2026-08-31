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

// Page names come from remote content — loadPage() calls scraped out of the
// P4HR shell and the keys of page-meta.json. They are interpolated into a
// shell command in fetchText() and used as a write path in step 7, so a name
// containing a quote could break out of the curl argument, and one containing
// ".." could write outside the repository. Neither is reachable today, but
// nothing upstream guarantees that. Unicode is allowed (page titles carry
// curly apostrophes); shell metacharacters and traversal are not.
const UNSAFE_NAME = /["'`$;|&<>\\\n\r\t*?(){}\[\]!~]/;
function isSafePageName(p) {
  if (typeof p !== 'string' || !p) return false;
  if (!p.toLowerCase().endsWith('.html')) return false;
  if (p.length > 200) return false;
  if (p.startsWith('/') || p.startsWith('.')) return false;
  if (p.includes('..') || p.includes('//')) return false;
  if (UNSAFE_NAME.test(p)) return false;
  return true;
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Fetch related-links.json once at build time for static Related Articles
let RELATED_DATA = null;
function loadRelatedLinks() {
  if (RELATED_DATA !== null) return RELATED_DATA;
  try {
    const raw = fetchText(`${SOURCE_URL}/related-links.json`);
    RELATED_DATA = raw ? JSON.parse(raw) : {};
    console.log(`   Related-links loaded: ${Object.keys(RELATED_DATA.related || {}).length} pages`);
  } catch (e) {
    console.log(`   Related-links FAILED: ${e.message}`);
    RELATED_DATA = {};
  }
  return RELATED_DATA;
}


// ─── Original framing: per-page editorial notes (mirror-only content) ───────
// Populate page-notes.json in the repo root:  { "faq.html": "Original text…" }
// Pages without an entry get nothing — boilerplate repeated across 177 pages
// would itself read as duplicate content.
let PAGE_NOTES = {};
try {
  if (fs.existsSync('page-notes.json')) {
    PAGE_NOTES = JSON.parse(fs.readFileSync('page-notes.json', 'utf-8')) || {};
    console.log(`   Page notes loaded: ${Object.keys(PAGE_NOTES).length} pages with original framing`);
  }
} catch (e) { console.log(`   page-notes.json parse failed: ${e.message}`); }

function buildEditorialNote(pageName) {
  const note = PAGE_NOTES[pageName];
  if (!note || note.trim().length < 40) return '';
  // Emitted as <section>, NOT <aside>: P4HR styles its nav sidebar with a bare
  // `aside` selector (width:250px; height:100vh; position:sticky), which any
  // <aside> we emit inherits wholesale. Using <aside> also made the note's
  // links match the mobile nav handler's closest('aside a') selector.
  return `\n<section class="mirror-note" role="note" aria-label="Editorial context">\n  <h2>Context</h2>\n  <p>${note}</p>\n</section>\n`;
}

// Build static Related Articles HTML for a page
function buildRelatedArticles(pageName) {
  const data = loadRelatedLinks();
  const rel = (data.related || {})[pageName];
  if (!rel || !rel.length) return '';
  const stand = data.standalone_titles || {};
  // Upstream related-links.json changed schema on 2026-08-26: "related" lists
  // now carry {slug, title} objects instead of bare filename strings. The old
  // string-only code passed the object through `|| rp` into .replace() and
  // crashed the whole build (TypeError: label.replace is not a function),
  // freezing the mirror at the 2026-08-26T20:21Z deploy. Accept both forms.
  const items = rel.map(function(entry) {
    const isObj = entry && typeof entry === 'object';
    const rp = String((isObj ? entry.slug : entry) || '');
    if (!rp || rp === pageName) return '';
    let label = (isObj && typeof entry.title === 'string' && entry.title)
             || stand[rp] || (pageMeta[rp] && pageMeta[rp].title) || rp;
    if (typeof label !== 'string') label = rp;
    label = label.replace(/\s*\|\s*(Pilots for HIMS Reform|P4HR)\s*$/, '');
    return `    <li><a href="/${rp}">${esc(label)}</a></li>`;
  }).filter(Boolean);
  if (!items.length) return '';
  return `\n<nav class="related-articles" aria-label="Related articles">\n  <h2>Related Articles</h2>\n  <ul>\n${items.join('\n')}\n  </ul>\n</nav>\n`;
}

// ─── Source footer boilerplate removal ──────────────────────────────────────
// Both patterns are constrained to a SINGLE <p> element via (?:(?!<\/p>)[\s\S])*?.
// The earlier lazy [\s\S]*? form began matching at the FIRST <p> in the
// document, so whenever the <footer> strip below failed to fire (disclaimer not
// wrapped in <footer>), it deleted the entire article body along with it.
const P_COPYRIGHT  = /<p[^>]*>(?:(?!<\/p>)[\s\S])*?©\s*20\d{2} Pilots for HIMS Reform(?:(?!<\/p>)[\s\S])*?<\/p>/gi;
const P_DISCLAIMER = /<p[^>]*>(?:(?!<\/p>)[\s\S])*?Disclaimer:(?:(?!<\/p>)[\s\S])*?not constitute legal(?:(?!<\/p>)[\s\S])*?<\/p>/gi;

// ─── Page CSS scoping ───────────────────────────────────────────────────────
// P4HR pages ship <style> blocks that style kickers, badges, meta lines and CTA
// buttons. Deleting them wholesale left naked text on 21 pages — e.g. the
// "P4HR — Oversight & Accountability" eyebrow above the H1 on
// submit-faa-complaint-dot-oig.html, and the "PDF" badges in the library pages.
//
// Rather than delete, every selector is rewritten under #main-content so page
// CSS cannot reach the shell's nav <aside>, .container or banner. Rules anchored
// on html/body/:root are dropped (they cannot be meaningfully scoped), and
// position:fixed|sticky is stripped because a fixed element escapes its
// container no matter how its selector is scoped — that is precisely how the
// editorial note ended up overlaying the page.
const CSS_SCOPE = '#main-content';

function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel) return null;
  if (/^(from|to|\d+(\.\d+)?%)$/i.test(sel)) return sel;   // @keyframes stop — never scope
  if (/^(html|body|:root)\b/i.test(sel)) return null;      // shell-level — drop
  if (sel.indexOf(CSS_SCOPE) === 0) return sel;            // already scoped
  return CSS_SCOPE + ' ' + sel;
}

function scopeCssRules(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const e = css.indexOf('*/', i + 2);
      i = e < 0 ? css.length : e + 2;
      continue;
    }
    const brace = css.indexOf('{', i);
    if (brace < 0) break;
    const prelude = css.slice(i, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    i = j;

    if (prelude.startsWith('@')) {
      const at = prelude.split(/[\s({]/)[0].toLowerCase();
      if (at === '@media' || at === '@supports') {
        const inner = scopeCssRules(body);            // recurse: scope the rules inside
        if (inner.trim()) out += prelude + ' {\n' + inner + '}\n';
      } else if (at === '@keyframes' || at === '@-webkit-keyframes' || at === '@font-face') {
        out += prelude + ' {' + body + '}\n';         // stops/descriptors pass through
      }
      continue;                                        // @import/@charset/@page dropped
    }

    const sels = prelude.split(',').map(scopeSelector).filter(Boolean);
    if (!sels.length) continue;
    const cleanBody = body.replace(/(^|;)\s*position\s*:\s*(fixed|sticky)\s*(?=;|$)/gi, '$1');
    if (!cleanBody.replace(/[;\s]/g, '')) continue;
    out += sels.join(', ') + ' {' + cleanBody + '}\n';
  }
  return out;
}

// Pull every <style> block out of the content and return the scoped equivalent.
function scopePageStyles(content) {
  const blocks = [];
  content = content.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, function (_m, css) {
    blocks.push(css);
    return '';
  });
  if (!blocks.length) return { content: content, css: '' };
  const raw = blocks.join('\n').replace(/@(import|charset)[^;]*;/gi, '');
  return { content: content, css: scopeCssRules(raw) };
}

/**
 * FIX 3 — Strip embedded <head> blocks from page content.
 * Preserves page-specific <style> rules (FAQ accordion, etc.) while
 * removing body/html/container-level CSS that conflicts with mirror shell.
 */
function cleanPageContent(raw, pageName) {
  let content = raw;

  // Strip sticky-subscribe button — renders unstyled after CSS stripping
  content = content.replace(/<a class="sticky-subscribe"[\s\S]*?<\/a>/gi, '');

  // ─── Runs on ALL content, fragment or full document ───
  // P4HR serves most pages as bare fragments with no <head>, so these used to
  // be skipped by the early return below — leaving GA reinjected and the
  // source footer intact on every fragment page.
  content = content.replace(/<script[^>]*src="[^"]*googletagmanager[^"]*"[^>]*><\/script>/gi, '');
  content = content.replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  content = content.replace(P_COPYRIGHT, '');
  content = content.replace(P_DISCLAIMER, '');

  // Extract and scope page CSS BEFORE the branch below. This has to happen
  // ahead of the <head> strip, because fragments that do carry a <head> keep
  // their <style> inside it — stripping the head first would discard the CSS.
  const styled = scopePageStyles(content);
  content = styled.content;
  const cleanedStyles = styled.css.trim().length > 20
    ? '<style id="mirror-page-css">\n' + styled.css + '</style>\n'
    : '';

  const trimmed = content.trimStart();
  const isFullDoc = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<html') || trimmed.startsWith('<head');
  const hasEmbeddedHead = content.includes('<head>') || content.includes('<head ');

  if (!isFullDoc && !hasEmbeddedHead) {
    return cleanedStyles + content;
  }

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

  // Strip remaining <head> sections (styles are already extracted above)
  content = content.replace(/<head[\s\S]*?<\/head>/gi, '');

  return cleanedStyles + content;
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
let pageMeta = {};
// P4HR moved PAGE_META to external page-meta.json — fetch it directly
try {
  const metaRaw = fetchText(`${SOURCE_URL}/page-meta.json`);
  if (metaRaw) pageMeta = JSON.parse(metaRaw) || {};
} catch (e) {
  console.log(`   page-meta.json fetch failed: ${e.message}`);
}
// Fallback: legacy inline PAGE_META block
if (Object.keys(pageMeta).length === 0) {
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
}
console.log(`   OK ${Object.keys(pageMeta).length} page meta entries\n`);

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

// Drop anything that could break out of the fetch command or escape the repo
const rejected = [...allPages].filter(p => !isSafePageName(p));
rejected.forEach(p => allPages.delete(p));
if (rejected.length) {
  console.log(`   ! ${rejected.length} page name(s) rejected as unsafe:`);
  rejected.forEach(p => console.log(`     - ${JSON.stringify(p)}`));
}

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

  // Nav links: ?page=X.html and /?page=X.html → /X.html
  r = r.replace(/href="\/?\?page=([^"]+)"/g, 'href="/$1"');

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

  // Any remaining href="?page=X" or "/?page=X" in content
  r = r.replace(/href="\/?\?page=([^"]+)"/g, 'href="/$1"');

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
shellBefore = shellBefore.replace(/<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/g, '');
shellBefore = shellBefore.replace(/<meta\s+name="application-name"\s+content="[^"]*"\s*\/?>/g, '<meta name="application-name" content="FAA HIMS Program Information">');

// ─── Inject CSS for fixed resource network panel (CSS-only, no DOM changes) ─
const mirrorCSS = `
<style id="mirror-enhancements">
  /* FIX 1: Hamburger + close buttons — hidden on desktop, positioned on mobile */
  #hamburger-toggle,
  #close-menu-toggle {
    display: none !important;
  }
  @media (max-width: 768px) {
    #hamburger-toggle {
      display: flex !important;
      z-index: 10001 !important;
      top: 52px !important;
      position: fixed !important;
      right: 15px !important;
    }
    #close-menu-toggle {
      z-index: 10001 !important;
      top: 52px !important;
      position: fixed !important;
      right: 15px !important;
    }
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
  /* FIX 4: Prevent content from running under resource panel.
     .container is display:flex in the P4HR shell, so #main-content is a
     flex item. Without flex-grow it shrink-to-fits its content and the
     column collapses. min-width:0 lets it shrink below intrinsic width
     instead of overflowing on long URLs and wide tables. */
  #main-content {
    flex: 1 1 auto !important;
    min-width: 0 !important;
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

  /* Editorial context block — mirror-only original content.
     Class-only selector, with explicit resets. P4HR styles its nav sidebar
     with a bare 'aside' selector: width:250px; height:100vh; position:sticky.
     max-width cannot override an explicit width, so an <aside> note rendered
     as a 250px x 100vh column and pushed page content to y=1187 — below the
     fold on a 1100px viewport. The resets stay as belt-and-braces even though
     the note is now emitted as <section>. */
  .mirror-note {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    position: static !important;
    overflow: visible !important;
    max-width: 900px; margin: 1.5rem auto 2rem; padding: 1rem 1.25rem;
    border-left: 4px solid #4a90d9; background: rgba(74,144,217,.07);
    border-radius: 6px; box-sizing: border-box;
  }
  .mirror-note h2 { font-size: 1rem; margin: 0 0 .5rem; letter-spacing: .02em; }
  .mirror-note p { margin: 0; line-height: 1.6; }

  /* Related Articles styling (page CSS is stripped, so style here) */
  nav.related-articles {
    margin: 2.5rem auto 1rem;
    padding: 1.25rem 20px 0;
    border-top: 1px solid rgba(128,128,128,.35);
    max-width: 900px;
  }
  nav.related-articles h2 { font-size: 1.15rem; margin: 0 0 .6rem; }
  nav.related-articles ul { margin: 0; padding-left: 1.2rem; }
  nav.related-articles li { margin: .35rem 0; }

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

  /* FAQ accordion styles (stripped from page content, re-added here) */
  .faq-accordion { max-width: 800px; margin: 0 auto; }
  .faq-item { margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
  .faq-question { padding: 16px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 600; background: #fff; }
  .faq-question:hover { background: #f0f4f8; }
  .faq-answer { display: none; padding: 16px 20px; background: #f9f9f9; border-top: 1px solid #eee; line-height: 1.6; }

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
      <p style="font-size:0.72rem;margin:0 0 4px;">
        <a href="/site-index.html" style="color:#4a90d9;">Complete page index</a>
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
// Fix hamburger position below banner
var hb = document.getElementById('hamburger-toggle');
if (hb) hb.style.top = '52px';
var cb = document.getElementById('close-menu-toggle');
if (cb) cb.style.top = '52px';

// Fix TOC button and sidebar position below banner
var tocBtn = document.getElementById('toc-toggle');
if (tocBtn) tocBtn.style.top = '52px';
var tocSidebar = document.getElementById('toc-sidebar');
if (tocSidebar) { tocSidebar.style.top = '90px'; tocSidebar.style.right = '340px'; }

// Close TOC when clicking a link inside it
if (tocSidebar) {
  tocSidebar.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') {
      tocSidebar.style.display = 'none';
    }
  });
}

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

// Neutralize SPA loadPage — this is a static mirror, direct navigation only
if (typeof loadPage === 'function') { loadPage = function(p) { window.location.href = '/' + p; }; }
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
  const title = meta?.title || `${pageName.replace(/[-_]/g, ' ').replace('.html', '')} | FAA HIMS Program Information`;
  const desc = meta?.description || 'FAA HIMS program information and pilot advocacy resources.';
  const canonical = pageName === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${encodeURI(pageName)}`;
  const p4hrLink = `${SOURCE_URL}/?page=${encodeURIComponent(pageName)}`;

  // SEO meta block
  // FAQPage schema for FAQ page — rich results eligibility
  let faqSchema = '';
  if (pageName === 'faq.html') {
    const faqPairs = [];
    const qRe = /<div class="faq-question"[^>]*>\s*<span>([\s\S]*?)<\/span>/g;
    const aRe = /<div class="faq-answer"[^>]*>([\s\S]*?)<\/div>/g;
    const questions = []; const answers = [];
    let qm, am;
    while ((qm = qRe.exec(content)) !== null) questions.push(qm[1].trim());
    while ((am = aRe.exec(content)) !== null) answers.push(am[1].replace(/<[^>]*>/g, '').trim().substring(0, 300));
    for (let fi = 0; fi < Math.min(questions.length, answers.length); fi++) {
      faqPairs.push({"@type":"Question","name":questions[fi],"acceptedAnswer":{"@type":"Answer","text":answers[fi]}});
    }
    if (faqPairs.length > 2) {
      faqSchema = `\n    <script type="application/ld+json">\n    ${JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":faqPairs})}\n    </script>`;
    }
  }
  const seo = `
    <!-- Mirror SEO: ${MIRROR_DOMAIN} -->
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}"/>
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"/>
    <link rel="canonical" href="${canonical}"/>
    <link rel="alternate" hreflang="en" href="${canonical}"/>
    <link rel="alternate" hreflang="x-default" href="${canonical}"/>
    <link rel="preload" as="image" href="/images/P4HR-Newest-Logo-Medium.png" fetchpriority="high"/>
    <meta property="og:title" content="${esc(title)}"/>
    <meta property="og:description" content="${esc(desc)}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:url" content="${canonical}"/>
    <meta property="og:site_name" content="FAA HIMS Program Information"/>
    <meta property="og:image" content="${MIRROR_URL}/images/P4HR-Newest-Logo-Medium.png"/>
    <meta name="twitter:image" content="${MIRROR_URL}/images/P4HR-Newest-Logo-Medium.png"/>
    <meta property="og:updated_time" content="${BUILD_TIME}"/>
    <meta name="twitter:card" content="summary"/>
    <meta name="twitter:title" content="${esc(title)}"/>
    <meta name="twitter:description" content="${esc(desc)}"/>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebPage","name":${JSON.stringify(title)},"description":${JSON.stringify(desc)},"url":"${canonical}","dateModified":"${BUILD_TIME}","isPartOf":{"@type":"WebSite","name":"FAA HIMS Program Information","url":"${MIRROR_URL}","alternateName":"HIMS Program Info"}}
    </script>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebSite","name":"FAA HIMS Program Information","alternateName":["HIMS Program Info","FAA HIMS Program","himsprogram.info"],"url":"${MIRROR_URL}"}
    </script>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${MIRROR_URL}/"}${pageName === 'index.html' ? '' : `,{"@type":"ListItem","position":2,"name":${JSON.stringify(title.split('|')[0].trim())},"item":"${canonical}"}`}]}
    </script>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"FAA HIMS Program Information","url":"${MIRROR_URL}","logo":"${MIRROR_URL}/images/P4HR-Newest-Logo-Medium.png","parentOrganization":{"@type":"Organization","name":"Pilots for HIMS Reform","url":"${SOURCE_URL}"}}
    </script>${faqSchema}`;
  
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

  // Rewrite the content links + append static Related Articles
  const rewrittenContent = buildEditorialNote(pageName) + rewriteLinks(content) + buildRelatedArticles(pageName);

  return `${head}\n${rewrittenContent}\n${shellAfter}\n<!-- Build #${BUILD_NUMBER} | ${MIRROR_DOMAIN} | ${BUILD_TIME} -->`;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6: Generate index.html (homepage)
// ═══════════════════════════════════════════════════════════════════════════

console.log('6. Generating index.html...');
const indexMeta = {
  title: `FAA HIMS Program Information & Reform | Pilot Advocacy Resource ${YEAR}`,
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
const crypto = require('crypto');
const contentHash = (x) => crypto.createHash('sha1').update(String(x)).digest('hex').slice(0, 16);
const pageHashes = { 'index.html': contentHash(homepageContent) };
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

  const pageContent = cleanPageContent(content, pageName);

  // Get SEO meta (from P4HR's PAGE_META or generate fallback)
  const meta = pageMeta[pageName] || {
    title: `${pageName.replace(/[-_]/g, ' ').replace('.html', '')} | FAA HIMS Program Information`,
    description: `FAA HIMS program information — ${pageName.replace('.html', '')}.`
  };

  const html = buildPage(pageName, pageContent, meta);
  // P4HR now publishes pages inside folders (articles/…). writeFileSync will
  // not create a missing parent, so make it before writing.
  const outDir = path.dirname(pageName);
  if (outDir && outDir !== '.') fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(pageName, html);
  pageHashes[pageName] = contentHash(pageContent);
  generated.push(pageName);
  okCount++;
  console.log(`✓ (${(html.length / 1024).toFixed(0)}K)`);
  sleep(FETCH_DELAY);
}
console.log(`\n   Result: ${okCount} generated, ${failCount} failed\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7b: Orphan sweep — delete root .html files this build did not generate
// ═══════════════════════════════════════════════════════════════════════════
console.log('7b. Sweeping orphaned pages...');
{
  if (failCount > 0) {
    console.log(`   SKIPPED — ${failCount} page(s) failed to fetch this build;`);
    console.log(`   sweeping now could delete valid pages.\n`);
  } else {
    const keep = new Set(generated.concat(['404.html', 'site-index.html']));
    let removed = 0;
    // Sweep the root plus only those folders this build actually wrote pages
    // into, so images/, .github/ and friends are never touched.
    const sweepDirs = new Set(['.']);
    for (const g of generated) {
      const dd = path.dirname(g);
      if (dd && dd !== '.') sweepDirs.add(dd);
    }
    for (const dir of sweepDirs) {
      let entries = [];
      try { entries = fs.readdirSync(dir); } catch (e) { continue; }
      for (const f of entries) {
        if (!f.endsWith('.html')) continue;
        const rel = dir === '.' ? f : `${dir}/${f}`;
        if (keep.has(rel)) continue;
        try { fs.unlinkSync(rel); removed++; console.log(`   - removed orphan: ${rel}`); }
        catch (e) { console.log(`   ! could not remove ${rel}: ${e.message}`); }
      }
    }
    console.log(`   ${removed} orphan page(s) removed\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7c: HTML site index — link equity + crawl discovery for every page
// ═══════════════════════════════════════════════════════════════════════════
console.log('7c. Generating site-index.html...');
{
  const rows = generated
    .filter(p => p !== 'index.html' && p !== '404.html')
    .sort()
    .map(p => {
      const label = (pageMeta[p] && pageMeta[p].title
        ? pageMeta[p].title.split('|')[0].trim()
        : p.replace(/[-_]/g, ' ').replace(/\.html$/, ''));
      return `    <li><a href="/${encodeURI(p)}">${esc(label)}</a></li>`;
    }).join('\n');
  const body = `
<section style="max-width:900px;margin:0 auto;padding:24px 20px;">
  <h1>Complete page index</h1>
  <p>Every page on this site, linked in one place &mdash; ${generated.length - 1} pages covering the
  FAA HIMS program, pilot and controller rights, legal cases, and reform efforts.
  For the full advocacy site, see <a href="${SOURCE_URL}">Pilots for HIMS Reform</a>.</p>
  <ul style="columns:2;column-gap:32px;line-height:1.9;">
${rows}
  </ul>
</section>`;
  const html = buildPage('site-index.html', body, {
    title: `Complete Page Index | FAA HIMS Program Information`,
    description: `Full directory of all ${generated.length - 1} pages on himsprogram.info covering FAA HIMS program requirements, pilot rights, legal cases, and reform advocacy.`
  });
  fs.writeFileSync('site-index.html', html);
  pageHashes['site-index.html'] = contentHash(rows);
  generated.push('site-index.html');
  console.log(`   OK site-index.html (${generated.length - 1} links)\n`);
}

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

// Per-page lastmod from content hashes: a page's lastmod only advances when
// its mirrored CONTENT changes (hashes are taken before the shell is added,
// so per-build stamps like dateModified cannot churn them). Previous state
// lives in sitemap-state.json; absent/corrupt state degrades to today for
// every page, which is exactly the old behavior.
const STATE_FILE = 'sitemap-state.json';
let smState = {};
try { smState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch (e) { smState = {}; }
const newState = {};
const lastmodFor = (p) => {
  const h = pageHashes[p] || '';
  const prev = smState[p];
  const m = (prev && prev.h === h && /^\d{4}-\d{2}-\d{2}$/.test(prev.m)) ? prev.m : today;
  newState[p] = { h, m };
  return m;
};

const smPages = generated.filter(p => p !== '404.html');
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${smPages.map(p => {
    const loc = p === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${encodeURI(p)}`;
    return `  <url><loc>${loc}</loc><lastmod>${lastmodFor(p)}</lastmod></url>`;
  }).join('\n')}
</urlset>`;
fs.writeFileSync('sitemap.xml', sitemapXml);
fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 0));
const changedCount = smPages.filter(p => newState[p].m === today).length;
console.log(`   ✓ sitemap.xml (${smPages.length} URLs, ${changedCount} with lastmod=today)`);

// sitemap-index.xml is no longer emitted. An index is only for sites that
// exceed 50,000 URLs or split across several files; this one wrapped a single
// 20KB sitemap. Worse, Search Console reports the URL count of whatever file
// you submit, and an index contains no page URLs — so submitting the index
// showed "Success, 0 discovered pages" and looked like a failure. One sitemap,
// one row, one honest number. Remove any leftover file so it cannot be served
// stale or resubmitted by mistake.
try {
  if (fs.existsSync('sitemap-index.xml')) {
    fs.unlinkSync('sitemap-index.xml');
    console.log('   ✓ removed obsolete sitemap-index.xml');
  }
} catch (e) { console.log(`   ! could not remove sitemap-index.xml: ${e.message}`); }
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 10: Generate robots.txt
// ═══════════════════════════════════════════════════════════════════════════

console.log('10. Generating robots.txt...');
fs.writeFileSync('robots.txt',
`# ${MIRROR_DOMAIN} — Pilots for HIMS Reform network
# Generated: ${BUILD_TIME}

User-agent: *
Allow: /
Disallow: /.github/
Disallow: /scripts/
Disallow: /node_modules/
Disallow: /page-notes.json

User-agent: Googlebot
Allow: /
Disallow: /.github/
Disallow: /scripts/
Disallow: /node_modules/
Disallow: /page-notes.json

User-agent: Bingbot
Allow: /
Disallow: /.github/
Disallow: /scripts/
Disallow: /node_modules/
Disallow: /page-notes.json

Sitemap: ${MIRROR_URL}/sitemap.xml
`);
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
