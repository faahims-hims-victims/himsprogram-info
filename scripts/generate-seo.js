const fs = require('fs');

const buildNumber = process.env.GITHUB_RUN_NUMBER || Math.floor(Math.random() * 1000);
const currentDateTime = new Date().toISOString();
const baseUrl = 'https://himsprogram.info';

const routes = [
  { path: '', output: 'index.html', priority: 1.0, changefreq: 'daily' },
  { path: 'about.html', output: 'about.html', priority: 0.9, changefreq: 'weekly' },
  { path: 'mission.html', output: 'mission.html', priority: 0.9, changefreq: 'weekly' },
  { path: 'stories.html', output: 'stories.html', priority: 0.95, changefreq: 'weekly' },
  { path: 'reform.html', output: 'reform.html', priority: 0.95, changefreq: 'weekly' },
  { path: 'advocacy.html', output: 'advocacy.html', priority: 0.9, changefreq: 'weekly' },
  { path: 'legal.html', output: 'legal.html', priority: 0.85, changefreq: 'monthly' },
  { path: 'resources.html', output: 'resources.html', priority: 0.85, changefreq: 'weekly' },
  { path: 'media.html', output: 'media.html', priority: 0.8, changefreq: 'weekly' },
  { path: 'contact.html', output: 'contact.html', priority: 0.7, changefreq: 'monthly' }
];

console.log('Generating SEO files');
console.log('Build: ' + buildNumber);
console.log('Date: ' + currentDateTime);

function generateSitemap() {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${routes.map(route => `  <url>
    <loc>${baseUrl}/${route.path}</loc>
    <lastmod>${currentDateTime}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
  <url>
    <loc>${baseUrl}/feed.xml</loc>
    <lastmod>${currentDateTime}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;

  fs.writeFileSync('sitemap.xml', sitemap);
  console.log('Generated sitemap.xml');
}

function generateRobotsTxt() {
  const robots = `# HIMS Program Information
# Build: ${buildNumber}
# Updated: ${currentDateTime}

User-agent: *
Allow: /

User-agent: Googlebot
Allow: /
Crawl-delay: 0.5

User-agent: Bingbot
Allow: /
Crawl-delay: 0.5

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/feed.xml

Host: ${baseUrl}`;

  fs.writeFileSync('robots.txt', robots);
  console.log('Generated robots.txt');
}

function generateRSSFeed() {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HIMS Program Information</title>
    <description>FAA HIMS program information, advocacy, and reform resources</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${currentDateTime}</lastBuildDate>
    
    <item>
      <title>FAA HIMS Program Information - Update ${buildNumber}</title>
      <description>Latest FAA HIMS program information and advocacy resources</description>
      <link>${baseUrl}/</link>
      <guid>${baseUrl}/?update=${buildNumber}</guid>
      <pubDate>${currentDateTime}</pubDate>
    </item>
  </channel>
</rss>`;

  fs.writeFileSync('feed.xml', rss);
  console.log('Generated feed.xml');
}

function generateHeaders() {
  const headers = `/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000
  Cache-Control: public, max-age=3600`;

  fs.writeFileSync('_headers', headers);
  console.log('Generated _headers');
}

function generateRedirects() {
  const redirects = `/about /about.html 200
/stories /stories.html 200
/reform /reform.html 200`;

  fs.writeFileSync('_redirects', redirects);
  console.log('Generated _redirects');
}

function generateManifest() {
  const manifest = {
    "name": "HIMS Program Information",
    "short_name": "HIMS Info",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#1a365d"
  };

  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
  console.log('Generated manifest.json');
}

try {
  generateSitemap();
  generateRobotsTxt();
  generateRSSFeed();
  generateHeaders();
  generateRedirects();
  generateManifest();
  
  console.log('SEO file generation complete');
  process.exit(0);
} catch (error) {
  console.error('Error generating SEO files: ' + error.message);
  process.exit(1);
}
