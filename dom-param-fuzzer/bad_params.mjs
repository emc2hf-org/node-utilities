import fs from 'fs';
import puppeteer from 'puppeteer';
import chalk from 'chalk';

function buildUrlWithParams(baseUrl, paramGroup) {
  const params = paramGroup.map(p => `${encodeURIComponent(p)}=testvalue`).join('&');
  return `${baseUrl}?${params}`;
}

function splitIntoUrlSafeBatches(params, baseUrl) {
  const MAX_URL_LENGTH = 2000;
  const batches = [];
  let currentBatch = [];
  let currentLength = baseUrl.length + 1;

  for (const param of params) {
    const entry = `${encodeURIComponent(param)}=testvalue`;
    const entryLength = entry.length + 1;

    if (currentLength + entryLength > MAX_URL_LENGTH) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = baseUrl.length + 1;
    }

    currentBatch.push(param);
    currentLength += entryLength;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function findConflictParam(baseUrl, paramBatch, browser) {
  const page = await browser.newPage();
  let conflictParam = null;

  try {
    if (paramBatch.length === 1) {
      const testUrl = buildUrlWithParams(baseUrl, [paramBatch[0]]);
      const response = await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      const status = response.status();
      if (status !== 200) {
        conflictParam = paramBatch[0];
      }
    } else {
      const mid = Math.floor(paramBatch.length / 2);
      const firstHalf = paramBatch.slice(0, mid);
      const secondHalf = paramBatch.slice(mid);

      conflictParam = await findConflictParam(baseUrl, firstHalf, browser) ||
                      await findConflictParam(baseUrl, secondHalf, browser);
    }
  } catch (err) {
    console.error(chalk.yellow(`[!] Error during conflict check: ${err.message}`));
  } finally {
    await page.close();
  }

  return conflictParam;
}

const args = process.argv.slice(2);

const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const hasFlag = (flag) => args.includes(flag);

const paramFilePath = getArgValue('-pf');
const urlFilePath = getArgValue('-uf');
const proxyArg = getArgValue('-p');
const workerCountArg = getArgValue('-w');

const CONCURRENT_WORKERS = parseInt(workerCountArg) || 5;

if (!paramFilePath || !urlFilePath) {
  console.error(chalk.red('Usage: node status_param_fuzzer_headless.mjs -pf params.txt -uf urls.txt [-w 10] [-p http://127.0.0.1:8080]'));
  process.exit(1);
}

let paramNames = fs.readFileSync(paramFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);
const targetUrls = fs.readFileSync(urlFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);

(async () => {
  const puppeteerArgs = [];
  const globalResults = {};
  const badParams = new Set();

  if (proxyArg) {
    puppeteerArgs.push(`--proxy-server=${proxyArg}`);
    console.log(chalk.cyan(`[*] Using proxy: ${proxyArg}`));
  }

  puppeteerArgs.push(`--ignore-certificate-errors`);
  const browser = await puppeteer.launch({ headless: true, args: puppeteerArgs });

  for (const baseUrl of targetUrls) {
    console.log(chalk.magentaBright(`\n🔍 Testing URL: ${baseUrl}`));

    let results = [];
    let batches = splitIntoUrlSafeBatches(paramNames, baseUrl);

    const runWorker = async (batchGroup) => {
      const page = await browser.newPage();
      for (const paramBatch of batchGroup) {
        const testUrl = buildUrlWithParams(baseUrl, paramBatch);

        try {
          const response = await page.goto(testUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          });

          const status = response.status();

          if (status === 200) {
            console.log(chalk.green(`[+] Status 200 for batch`));
          } else {
            console.log(chalk.yellow(`[!] Status ${status} received, checking for conflicts...`));
            console.log(chalk.yellow(`[i] Batch: ${paramBatch}`));
            const conflict = await findConflictParam(baseUrl, paramBatch, browser);

            if (conflict) {
              console.log(chalk.redBright(`[!] Conflict found: ${conflict}`));
              badParams.add(conflict);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 750));
        } catch (err) {
          console.error(chalk.yellow(`[!] Error testing batch: ${err.message}`));
        }
      }
      await page.close();
    };

    if (badParams.size > 0) {
      paramNames = paramNames.filter(p => !badParams.has(p));
      batches = splitIntoUrlSafeBatches(paramNames, baseUrl);
      console.log(chalk.cyan(`[*] Retrying with cleaned parameters`));
    }

    const batchGroups = Array.from({ length: CONCURRENT_WORKERS }, () => []);
    batches.forEach((batch, i) => {
      batchGroups[i % CONCURRENT_WORKERS].push(batch);
    });

    console.log(chalk.cyan(`[*] Fuzzing ${paramNames.length} params in ${batches.length} batches...`));
    await Promise.all(batchGroups.map(group => runWorker(group)));

    globalResults[baseUrl] = results;
  }

  await browser.close();

  console.log(chalk.magentaBright('\n=== FINAL RESULTS ==='));
  for (const [url] of Object.entries(globalResults)) {
    console.log(chalk.greenBright(`✅ ${url}: tested`));
  }

  if (badParams.size > 0) {
    console.log(chalk.redBright(`\n⚠️  Conflicting parameters: ${[...badParams].join(', ')}`));
  }
})();
