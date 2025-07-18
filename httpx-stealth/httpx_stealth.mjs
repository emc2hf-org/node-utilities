process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'fs/promises';
import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Argument parsing
const args = process.argv.slice(2);
const getArg = (flag, defaultVal = null) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultVal;
};

const file = getArg('-l');
const showStatusCode = args.includes('-sc');
const showContentLength = args.includes('-cl');
const takeScreenshots = args.includes('-ss');
const proxy = getArg('-p');
const workers = parseInt(getArg('-w', '5'));
const headless = args.includes('-hs');
const outputFile = getArg('-o');

if (!file) {
  console.error('Usage: node visitLinks.mjs -l <file> [-sc] [-cl] [-ss] [-p <proxy>] [-w <workers>] [-hs] [-o <output_file>]');
  process.exit(1);
}

// Ensure screenshots folder
if (takeScreenshots && !existsSync('screenshots')) {
  mkdirSync('screenshots');
}

// HTML Report Template
const htmlHeader = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screenshot Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 16px; vertical-align: top; word-wrap: break-word; }
    td.meta { font-family: monospace; font-size: 16px; text-align: left; white-space: pre-wrap; width: 60%; }
    td.meta strong { display: inline-block; width: 110px; color: #333; }
    td.image { text-align: center; vertical-align: middle; }
    img { max-width: 200px; border: 1px solid #ddd; border-radius: 4px; transition: transform 0.2s; }
    img:hover { transform: scale(1.5); }
    a { text-decoration: none; color: #0066cc; }
  </style>
</head>
<body>
  <h1>Screenshot Report</h1>
  <table>
    <tr><th>Data</th><th>Screenshot</th></tr>
`;

const htmlFooter = `
  </table>
</body>
</html>
`;

// Read URL list
const urls = (await fs.readFile(file, 'utf8')).split('\n').map(u => u.trim()).filter(Boolean);

// Visit a single URL
const visitUrl = async (page, url) => {
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const status = response.status();
    const headers = response.headers();
    const content = await response.buffer();
    const length = content.length;

    const title = await page.title();
    const server = headers['server'];
    const poweredBy = headers['x-powered-by'];

    const screenshotName = url.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
    const screenshotPath = `screenshots/${screenshotName}`;

    if (takeScreenshots) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const output = [
      url,
      showStatusCode ? `[${status}]` : null,
      showContentLength ? `[${length}]` : null
    ].filter(Boolean).join(' ');

    console.log(output);
    if (outputFile) appendFileSync(outputFile, output + '\n');

    if (takeScreenshots) {
      let meta = `<strong>URL:</strong> ${url}
<strong>Title:</strong> ${title}
<strong>Status:</strong> ${status}
<strong>Length:</strong> ${length}`;
      if (server) meta += `\n<strong>Server:</strong> ${server}`;
      if (poweredBy) meta += `\n<strong>X-Powered-By:</strong> ${poweredBy}`;

      const row = `<tr>
        <td class="meta">${meta}</td>
        <td class="image"><a href="${screenshotName}" target="_blank"><img src="${screenshotName}" alt="Screenshot"></a></td>
      </tr>`;
      await fs.appendFile('screenshots/screenshot.html', row + '\n');
    }
  } catch (err) {
    const errMsg = `${url} [ERROR: ${err.message}]`;
    console.log(errMsg);
    if (outputFile) appendFileSync(outputFile, errMsg + '\n');
  }
};

// Main runner
const run = async () => {
  if (outputFile) writeFileSync(outputFile, ''); // clear log

  if (takeScreenshots) {
    await fs.writeFile('screenshots/screenshot.html', htmlHeader); // start HTML
  }

  const browser = await puppeteer.launch({
    headless,
    ignoreHTTPSErrors: true,
    args: [
      '--ignore-certificate-errors',
      '--ignore-urlfetcher-cert-requests',
      '--disable-features=HttpsFirstBalancedModeAutoEnable',
      ...(proxy ? [`--proxy-server=${proxy}`] : [])
    ]
  });

  const pages = await Promise.all(Array.from({ length: workers }, () => browser.newPage()));
  let urlIndex = 0;

  const worker = async (page) => {
    while (urlIndex < urls.length) {
      const current = urlIndex++;
      await visitUrl(page, urls[current]);
    }
  };

  await Promise.all(pages.map(worker));
  await browser.close();

  if (takeScreenshots) {
    await fs.appendFile('screenshots/screenshot.html', htmlFooter);
  }
};

await run();
