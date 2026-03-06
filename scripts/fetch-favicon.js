const https = require('https');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://pilotsforhimsreform.org';
const assetsDir = './assets';

console.log('Fetching favicons from P4HR');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('Created assets directory');
}

const faviconFiles = [
  { url: '/favicon.ico', output: 'favicon.ico' },
  { url: '/favicon-32x32.png', output: 'favicon-32x32.png' },
  { url: '/favicon-16x16.png', output: 'favicon-16x16.png' },
  { url: '/apple-touch-icon.png', output: 'apple-touch-icon.png' },
  { url: '/android-chrome-192x192.png', output: 'icon-192.png' },
  { url: '/android-chrome-512x512.png', output: 'icon-512.png' }
];

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Downloaded: ' + path.basename(outputPath));
          resolve();
        });
      } else if (response.statusCode === 404) {
        fs.unlink(outputPath, () => {});
        console.log('Not found: ' + url);
        resolve();
      } else {
        fs.unlink(outputPath, () => {});
        reject(new Error('Failed to download ' + url + ': ' + response.statusCode));
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function fetchAllFavicons() {
  for (const favicon of faviconFiles) {
    const url = baseUrl + favicon.url;
    const outputPath = path.join(assetsDir, favicon.output);
    
    try {
      await downloadFile(url, outputPath);
    } catch (error) {
      console.log('Skipped: ' + favicon.output + ' - ' + error.message);
    }
  }
  
  console.log('Favicon fetch complete');
}

fetchAllFavicons().catch(console.error);
