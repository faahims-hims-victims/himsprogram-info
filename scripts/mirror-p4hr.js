const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://pilotsforhimsreform.org';
const outputDir = '.';
const buildNumber = process.env.GITHUB_RUN_NUMBER || Math.floor(Math.random() * 1000);
const currentDateTime = new Date().toISOString();

const routes = [
  { 
    path: '/', 
    output: 'index.html', 
    priority: 1.0,
    title: 'FAA HIMS Program Information & Reform | Official Advocacy Resource 2026',
    description: 'Comprehensive FAA HIMS program information, requirements, reform initiatives, and pilot advocacy. Expert guidance on medical certification, treatment, AME selection, and return to flying. Updated hourly with latest policy changes.',
    keywords: 'FAA HIMS program, HIMS program requirements, FAA medical certification, pilot medical certificate, HIMS AME, special issuance medical, aviation substance abuse, pilot recovery program, FAA HIMS reform, pilot advocacy, medical certificate reinstatement, HIMS treatment facilities, aviation medical examiner, pilot rehabilitation, FAA aerospace medicine'
  },
  { 
    path: '/about', 
    output: 'about.html', 
    priority: 0.9,
    title: 'About HIMS Program Reform | Pilots for HIMS Advocacy & Transparency',
    description: 'Mission to reform FAA HIMS program through transparency, accountability, and fairness. Learn about pilot advocacy efforts, policy reform initiatives, and why the HIMS program needs change.',
    keywords: 'HIMS reform, pilot advocacy, FAA transparency, HIMS program criticism, aviation medical reform, pilot rights, FAA accountability'
  },
  { 
    path: '/stories', 
    output: 'stories.html', 
    priority: 0.95,
    title: 'Real Pilot HIMS Stories | Experiences with FAA Medical Certification Process',
    description: 'Authentic pilot experiences navigating the FAA HIMS program. Read real stories of medical certification challenges, recovery journeys, and successful returns to flying.',
    keywords: 'HIMS pilot stories, pilot experiences, HIMS testimonials, aviation recovery stories, pilot medical certification journey, HIMS program challenges, pilot rehabilitation success'
  },
  { 
    path: '/reform', 
    output: 'reform.html', 
    priority: 0.95,
    title: 'HIMS Program Reform Initiatives | FAA Policy Changes & Advocacy Efforts',
    description: 'Current FAA HIMS program reform initiatives, proposed policy changes, transparency efforts, and advocacy for fair treatment of pilots in recovery.',
    keywords: 'HIMS reform initiatives, FAA policy changes, HIMS program improvements, aviation medical advocacy, pilot rights advocacy, FAA transparency initiatives'
  },
  { 
    path: '/advocacy', 
    output: 'advocacy.html', 
    priority: 0.9,
    title: 'Pilot Advocacy & HIMS Support | Legal Resources & Rights Protection',
    description: 'Comprehensive advocacy resources for pilots in HIMS. Legal guidance, rights protection, policy analysis, and support for navigating FAA medical certification.',
    keywords: 'pilot advocacy, HIMS legal support, pilot rights, FAA medical law, aviation attorney resources, pilot legal rights'
  },
  { 
    path: '/legal', 
    output: 'legal.html', 
    priority: 0.85,
    title: 'HIMS Legal Resources | FAA Medical Certification Law & Appeals Process',
    description: 'Legal resources for pilots dealing with FAA HIMS requirements, medical denials, appeals, and aviation medical law. Find qualified aviation attorneys.',
    keywords: 'HIMS legal resources, FAA medical law, aviation attorney, medical certification appeal, pilot legal rights, FAA denial appeal'
  },
  { 
    path: '/resources', 
    output: 'resources.html', 
    priority: 0.85,
    title: 'HIMS Program Resources | Complete FAA Medical Certification Guide',
    description: 'Comprehensive FAA HIMS program resources: treatment facilities, HIMS AME directory, monitoring requirements, testing protocols, and certification procedures.',
    keywords: 'HIMS resources, FAA medical certification guide, HIMS AME directory, treatment facilities, monitoring requirements'
  },
  { 
    path: '/media', 
    output: 'media.html', 
    priority: 0.8,
    title: 'HIMS Media Coverage | Aviation Medical News, Press Releases & Updates',
    description: 'Latest media coverage of FAA HIMS program reform, pilot advocacy news, aviation medical policy changes, and press releases.',
    keywords: 'HIMS media, aviation news, pilot advocacy press, FAA medical updates, HIMS program news'
  },
  { 
    path: '/contact', 
    output: 'contact.html', 
    priority: 0.7,
    title: 'Contact HIMS Reform Advocates | Get Support & Information',
    description: 'Contact Pilots for HIMS Reform for advocacy support, program guidance, media inquiries, and reform collaboration opportunities.',
    keywords: 'contact HIMS reform, pilot advocacy contact, HIMS support'
  }
];

async function mirrorSPA() {
  console.log('\n=== HIMS PROGRAM INFO MIRROR ===');
  console.log('Build #' + buildNumber);
  console.log('Source: ' + baseUrl + '\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  for (const route of routes) {
    const url = baseUrl + route.path;
    console.log('Mirroring: ' + url);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForTimeout(5000);
      
      let html = await page.content();
      html = enhanceSEO(html, route);
      html = updateLinks(html);
      html = addNetworkFooter(html);
      
      fs.writeFileSync(path.join(outputDir, route.output), html, 'utf8');
      console.log('Saved: ' + route.output);
      
    } catch (error) {
      console.error('Failed to mirror ' + url + ': ' + error.message);
    }
  }
  
  await browser.close();
  console.log('\nMirror complete\n');
}

function enhanceSEO(html, route) {
  const seoHead = `
    <title>${route.title}</title>
    <meta name="description" content="${route.description}">
    <meta name="keywords" content="${route.keywords}">
    <link rel="canonical" href="https://himsprogram.info/${route.output === 'index.html' ? '' : route.output}">
    
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="googlebot" content="index, follow, max-snippet:-1">
    <meta name="bingbot" content="index, follow, max-snippet:-1">
    <meta name="author" content="Pilots for HIMS Reform - Aviation Medical Advocacy">
    <meta name="revisit-after" content="6 hours">
    <meta name="distribution" content="global">
    
    <meta name="news_keywords" content="FAA HIMS program, pilot medical certification, aviation reform">
    <meta name="article:published_time" content="${currentDateTime}">
    <meta name="article:modified_time" content="${currentDateTime}">
    <meta name="article:author" content="Pilots for HIMS Reform">
    <meta name="article:section" content="Aviation Medical Certification">
    
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://himsprogram.info/${route.output === 'index.html' ? '' : route.output}">
    <meta property="og:title" content="${route.title}">
    <meta property="og:description" content="${route.description}">
    <meta property="og:image" content="https://himsprogram.info/assets/icon-512.png">
    <meta property="og:site_name" content="HIMS Program Information">
    <meta property="og:updated_time" content="${currentDateTime}">
    
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${route.title}">
    <meta name="twitter:description" content="${route.description}">
    <meta name="twitter:image" content="https://himsprogram.info/assets/icon-512.png">
    
    <link rel="icon" href="/assets/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "MedicalWebPage",
      "name": "${route.title}",
      "description": "${route.description}",
      "url": "https://himsprogram.info/${route.output === 'index.html' ? '' : route.output}",
      "datePublished": "${currentDateTime}",
      "dateModified": "${currentDateTime}",
      "author": {
        "@type": "Organization",
        "name": "Pilots for HIMS Reform",
        "url": "https://pilotsforhimsreform.org"
      },
      "about": {
        "@type": "MedicalTherapy",
        "name": "FAA HIMS Program",
        "alternateName": "Human Intervention Motivation Study",
        "description": "Federal Aviation Administration program for aviation professionals with substance use disorders"
      },
      "audience": {
        "@type": "MedicalAudience",
        "audienceType": "Commercial and Private Pilots"
      }
    }
    </script>
    
    <meta name="build-number" content="${buildNumber}">
    <meta name="last-updated" content="${currentDateTime}">
    <meta name="update-frequency" content="Every 6 hours">
`;

  return html.replace(/<\/head>/i, seoHead + '\n</head>');
}

function updateLinks(html) {
  return html
    .replace(/href="\/about"/g, 'href="/about.html"')
    .replace(/href="\/mission"/g, 'href="/mission.html"')
    .replace(/href="\/stories"/g, 'href="/stories.html"')
    .replace(/href="\/reform"/g, 'href="/reform.html"')
    .replace(/href="\/advocacy"/g, 'href="/advocacy.html"')
    .replace(/href="\/legal"/g, 'href="/legal.html"')
    .replace(/href="\/resources"/g, 'href="/resources.html"')
    .replace(/href="\/media"/g, 'href="/media.html"')
    .replace(/href="\/contact"/g, 'href="/contact.html"');
}

function addNetworkFooter(html) {
  const footer = `
  <div style="background:linear-gradient(135deg,#f8f9fa,#e9ecef);padding:50px 20px;margin-top:60px;font-family:-apple-system,sans-serif">
    <div style="max-width:1200px;margin:0 auto">
      <h2 style="text-align:center;color:#1a365d;font-size:2em;margin-bottom:15px">Comprehensive HIMS Resource Network</h2>
      <p style="text-align:center;max-width:800px;margin:0 auto 40px;color:#4a5568;font-size:1.1em;line-height:1.6">
        Complete ecosystem of pilot advocacy, community support, and reform resources through interconnected network.
      </p>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:40px">
        <a href="https://himsprogram.info" style="background:white;padding:30px;border-radius:8px;text-decoration:none;border-left:4px solid #3182ce;box-shadow:0 4px 15px rgba(0,0,0,0.08)">
          <h3 style="color:#1a365d;font-size:1.3em;margin-bottom:10px">Program Information</h3>
          <p style="color:#4a5568;line-height:1.6">Comprehensive FAA HIMS program details, requirements, and advocacy resources updated every 6 hours</p>
        </a>
        
        <a href="https://faahims.rehab" style="background:white;padding:30px;border-radius:8px;text-decoration:none;border-left:4px solid #38a169;box-shadow:0 4px 15px rgba(0,0,0,0.08)">
          <h3 style="color:#1a365d;font-size:1.3em;margin-bottom:10px">Community Forum</h3>
          <p style="color:#4a5568;line-height:1.6">Active pilot community with 600+ members sharing real experiences and peer support</p>
        </a>
        
        <a href="https://pilotrecovery.org" style="background:white;padding:30px;border-radius:8px;text-decoration:none;border-left:4px solid #805ad5;box-shadow:0 4px 15px rgba(0,0,0,0.08)">
          <h3 style="color:#1a365d;font-size:1.3em;margin-bottom:10px">Recovery Resources</h3>
          <p style="color:#4a5568;line-height:1.6">Treatment facilities, success stories, and rehabilitation support for aviation professionals</p>
        </a>
        
        <a href="https://pilotsforhimsreform.org" style="background:white;padding:30px;border-radius:8px;text-decoration:none;border-left:4px solid #e53e3e;box-shadow:0 4px 15px rgba(0,0,0,0.08)">
          <h3 style="color:#1a365d;font-size:1.3em;margin-bottom:10px">Reform Advocacy</h3>
          <p style="color:#4a5568;line-height:1.6">Official Pilots for HIMS Reform organization leading policy change efforts</p>
        </a>
      </div>
      
      <div style="background:white;padding:30px;border-radius:8px;border-top:4px solid #3182ce;box-shadow:0 4px 15px rgba(0,0,0,0.08)">
        <h3 style="color:#1a365d;text-align:center;margin-bottom:20px;font-size:1.4em">Network Features</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;text-align:center">
          <div>
            <div style="font-size:2.5em;color:#3182ce;font-weight:bold;margin-bottom:5px">6 HR</div>
            <div style="color:#4a5568;font-weight:600">Update Frequency</div>
            <div style="font-size:0.9em;color:#718096">Automated content refresh</div>
          </div>
          <div>
            <div style="font-size:2.5em;color:#38a169;font-weight:bold;margin-bottom:5px">600+</div>
            <div style="color:#4a5568;font-weight:600">Active Pilots</div>
            <div style="font-size:0.9em;color:#718096">Real community engagement</div>
          </div>
          <div>
            <div style="font-size:2.5em;color:#805ad5;font-weight:bold;margin-bottom:5px">4</div>
            <div style="color:#4a5568;font-weight:600">Interconnected Sites</div>
            <div style="font-size:0.9em;color:#718096">Comprehensive coverage</div>
          </div>
          <div>
            <div style="font-size:2.5em;color:#e53e3e;font-weight:bold;margin-bottom:5px">24/7</div>
            <div style="color:#4a5568;font-weight:600">Information Access</div>
            <div style="font-size:0.9em;color:#718096">Always available resources</div>
          </div>
        </div>
      </div>
      
      <p style="text-align:center;margin-top:30px;color:#718096;font-size:0.95em">
        Fresh content every 6 hours | Cross-site network | Pilot stories and advocacy | Community engagement
      </p>
      <p style="text-align:center;opacity:0.7;font-size:0.85em;font-family:monospace;margin-top:15px;color:#4a5568">
        Build #${buildNumber} | ${new Date(currentDateTime).toLocaleString('en-US', { timeZone: 'UTC' })} UTC | Next update in under 6 hours
      </p>
    </div>
  </div>
`;

  return html.replace(/<\/body>/i, footer + '\n</body>');
}

mirrorSPA().catch(console.error);
