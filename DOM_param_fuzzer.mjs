import fs from 'fs';
import puppeteer from 'puppeteer';
import chalk from 'chalk';

// --- Parse CLI arguments ---
const args = process.argv.slice(2);

const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const paramFilePath = getArgValue('-pf');
const urlFilePath = getArgValue('-uf');
const workerCountArg = getArgValue('-w');

if (!paramFilePath || !urlFilePath) {
  console.error(chalk.red('Usage: node xss_param_fuzzer_headless.mjs -pf params.txt -uf url.txt [-w 10]'));
  process.exit(1);
}

const CONCURRENT_WORKERS = parseInt(workerCountArg) || 5;

// --- Read inputs ---
const paramNames = fs.readFileSync(paramFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);
const targetBaseUrl = fs.readFileSync(urlFilePath, 'utf-8').trim();

const marker = 'XSSFOUND';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const results = [];

  const runWorker = async (paramsChunk) => {
    const page = await browser.newPage();
    for (const param of paramsChunk) {
      const testUrl = `${targetBaseUrl}?${param}=${marker}`;
      try {
        await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 15000 });
        const content = await page.content();
        if (content.includes(marker)) {
          console.log(chalk.green(`[+] Reflected in DOM: ${param}`));
          results.push(param);
        } else {
          console.log(chalk.red(`[-] Not found: ${param}`));
        }
      } catch (err) {
        console.error(chalk.yellow(`[!] Error testing ${param}: ${err.message}`));
      }
    }
    await page.close();
  };

  // --- Divide work into chunks ---
  const chunkSize = Math.ceil(paramNames.length / CONCURRENT_WORKERS);
  const paramChunks = [];
  for (let i = 0; i < paramNames.length; i += chunkSize) {
    paramChunks.push(paramNames.slice(i, i + chunkSize));
  }

  console.log(chalk.cyan(`[*] Testing ${paramNames.length} params with ${CONCURRENT_WORKERS} workers...\n`));

  await Promise.all(paramChunks.map(chunk => runWorker(chunk)));

  await browser.close();

  console.log(chalk.cyan(`\n✅ Done. Reflected parameters: ${results.length > 0 ? results.join(', ') : 'None'}`));
})();
