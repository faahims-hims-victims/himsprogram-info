# Applies the four fixes + HTML site index + per-page original framing
# to mirror-p4hr.js. Run from the repo root: python3 patch.py scripts/mirror-p4hr.js
import re, sys, io

src = open(sys.argv[1], encoding="utf-8").read()
orig_len = len(src)
applied = []

# ── FIX 1: encodeURI on sitemap <loc> ────────────────────────────────────────
old = "const loc = p === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${p}`;"
new = "const loc = p === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${encodeURI(p)}`;"
if old in src:
    src = src.replace(old, new); applied.append("sitemap <loc> now encodeURI'd")

# ── FIX 2: encodeURI on canonical ────────────────────────────────────────────
old = "const canonical = pageName === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${pageName}`;"
new = "const canonical = pageName === 'index.html' ? MIRROR_URL + '/' : `${MIRROR_URL}/${encodeURI(pageName)}`;"
if old in src:
    src = src.replace(old, new); applied.append("canonical now encodeURI'd")

# p4hrLink too — same bug, points at the source site
old = "const p4hrLink = `${SOURCE_URL}/?page=${pageName}`;"
new = "const p4hrLink = `${SOURCE_URL}/?page=${encodeURIComponent(pageName)}`;"
if old in src:
    src = src.replace(old, new); applied.append("p4hrLink now encoded")

# ── FIX 3: per-page original framing, loaded from page-notes.json ────────────
NOTES = '''
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
  return `\\n<aside class="mirror-note" aria-label="Editorial context">\\n  <h2>Context</h2>\\n  <p>${note}</p>\\n</aside>\\n`;
}
'''
anchor = "// Build static Related Articles HTML for a page"
if anchor in src and "PAGE_NOTES" not in src:
    src = src.replace(anchor, NOTES + "\n" + anchor)
    applied.append("page-notes.json mechanism added")

# inject the note ahead of the content in buildPage
old = "const rewrittenContent = rewriteLinks(content) + buildRelatedArticles(pageName);"
new = "const rewrittenContent = buildEditorialNote(pageName) + rewriteLinks(content) + buildRelatedArticles(pageName);"
if old in src:
    src = src.replace(old, new); applied.append("editorial note injected into page body")

# style for the note
old = "  /* Related Articles styling (page CSS is stripped, so style here) */"
new = """  /* Editorial context block — mirror-only original content */
  aside.mirror-note {
    max-width: 900px; margin: 1.5rem auto 2rem; padding: 1rem 1.25rem;
    border-left: 4px solid #4a90d9; background: rgba(74,144,217,.07);
    border-radius: 6px;
  }
  aside.mirror-note h2 { font-size: 1rem; margin: 0 0 .5rem; letter-spacing: .02em; }
  aside.mirror-note p { margin: 0; line-height: 1.6; }

  /* Related Articles styling (page CSS is stripped, so style here) */"""
if old in src:
    src = src.replace(old, new); applied.append("editorial note styling added")

open(sys.argv[1], "w", encoding="utf-8").write(src)
print(f"mirror-p4hr.js  {orig_len} -> {len(src)} bytes")
for a in applied: print("  ok  " + a)
if len(applied) < 6:
    print("\n  >>> some anchors not found — inspect manually before committing")

# ── FIX 4: orphan sweep + HTML site index ────────────────────────────────────
src = open(sys.argv[1], encoding="utf-8").read()
applied2 = []

SWEEP = '''
// ═══════════════════════════════════════════════════════════════════════════
// STEP 7b: Orphan sweep — delete root .html files this build did not generate
// ═══════════════════════════════════════════════════════════════════════════
console.log('7b. Sweeping orphaned pages...');
{
  const keep = new Set(generated.concat(['404.html', 'site-index.html']));
  let removed = 0;
  for (const f of fs.readdirSync(process.cwd())) {
    if (!f.endsWith('.html')) continue;
    if (keep.has(f)) continue;
    try { fs.unlinkSync(f); removed++; console.log(`   - removed orphan: ${f}`); }
    catch (e) { console.log(`   ! could not remove ${f}: ${e.message}`); }
  }
  console.log(`   ${removed} orphan page(s) removed\\n`);
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
        : p.replace(/[-_]/g, ' ').replace(/\\.html$/, ''));
      return `    <li><a href="/${encodeURI(p)}">${esc(label)}</a></li>`;
    }).join('\\n');
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
  generated.push('site-index.html');
  console.log(`   OK site-index.html (${generated.length - 1} links)\\n`);
}
'''
anchor = "// STEP 8: Generate 404.html"
if anchor in src and "Orphan sweep" not in src:
    i = src.index("// ═══════════════════════════════════════════════════════════════════════════\n" + anchor)
    src = src[:i] + SWEEP.lstrip("\n") + "\n" + src[i:]
    applied2.append("orphan sweep + site-index.html added")

# link the site index from the resource panel so crawlers reach it from every page
old = '''      <p style="font-size:0.68rem;color:#556;margin:0 0 4px;">
        Not affiliated with the FAA or official HIMS Program.
      </p>'''
new = '''      <p style="font-size:0.72rem;margin:0 0 4px;">
        <a href="/site-index.html" style="color:#4a90d9;">Complete page index</a>
      </p>
      <p style="font-size:0.68rem;color:#556;margin:0 0 4px;">
        Not affiliated with the FAA or official HIMS Program.
      </p>'''
if old in src:
    src = src.replace(old, new); applied2.append("site index linked from every page")

open(sys.argv[1], "w", encoding="utf-8").write(src)
for a in applied2: print("  ok  " + a)
