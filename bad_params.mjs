import fs from 'fs';
import puppeteer from 'puppeteer';
import chalk from 'chalk';
import path from 'path';
import { mkdir } from 'fs/promises';

function checkUnique(currentParam, paramBatch, content, markerPrefix) {
    const longerParams = paramBatch.filter(p => 
        p.length > currentParam.length && p.includes(currentParam)
    );
    
    for (const longerParam of longerParams) {
        const longerMarker = `${markerPrefix}${longerParam}`;
        if (content.includes(longerMarker)) {
            return false;
        }
    }
    
    const currentMarker = `${markerPrefix}${currentParam}`;
    return content.includes(currentMarker);
}

async function findConflictParam(baseUrl, paramBatch, browser) {
    const page = await browser.newPage();
    let conflictParam = null;
    
    try {
        if (paramBatch.length === 1) {
            const testBatch = [paramBatch[0], 'name'];
            const testUrl = buildUrlWithParams(baseUrl, testBatch);
            await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const content = await page.content();
            
            if (!checkUnique('name', testBatch, content, 'XSSFOUND123')) {
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
const takeScreenshots = hasFlag('-s');

const CONCURRENT_WORKERS = parseInt(workerCountArg) || 5;
const MAX_URL_LENGTH = 2000;
const markerPrefix = 'XSSFOUND123';

if (!paramFilePath || !urlFilePath) {
  console.error(chalk.red('Usage: node xss_param_fuzzer_headless.mjs -pf params.txt -uf urls.txt [-w 10] [-p http://127.0.0.1:8080] [-s]'));
  process.exit(1);
}

let paramNames = fs.readFileSync(paramFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);
const targetUrls = fs.readFileSync(urlFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);

const buildUrlWithParams = (baseUrl, paramGroup) => {
  const params = [...paramGroup, 'name'].map(p => `${encodeURIComponent(p)}=${markerPrefix}${p}`).join('&');
  return `${baseUrl}?${params}`;
};

const splitIntoUrlSafeBatches = (params, baseUrl) => {
  const batches = [];
  let currentBatch = [];
  let currentLength = baseUrl.length + 1;

  // Account for 'name' parameter in every batch
  const nameEntry = `${encodeURIComponent('name')}=${markerPrefix}name`;
  currentLength += nameEntry.length + 1;

  for (const param of params.filter(p => p !== 'name')) {
    const entry = `${encodeURIComponent(param)}=${markerPrefix}${param}`;
    const entryLength = entry.length + 1;

    if (currentLength + entryLength > MAX_URL_LENGTH) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = baseUrl.length + 1 + nameEntry.length + 1;
    }

    currentBatch.push(param);
    currentLength += entryLength;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

const sanitize = str => str.replace(/[^a-zA-Z0-9-_]/g, '_');

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

          const content = await page.content();
          let tookScreenshot = false;
          let nameReflected = checkUnique('name', [...paramBatch, 'name'], content, markerPrefix);

          if (nameReflected) {
            console.log(chalk.green(`[+] 'name' reflected in batch`));
            results.push('name');
          } else {
            console.log(chalk.yellow(`[!] 'name' not reflected, checking for conflicts...`));
            const conflict = await findConflictParam(baseUrl, paramBatch, browser);
            
            if (conflict) {
              console.log(chalk.redBright(`[!] Conflict found: ${conflict}`));
              badParams.add(conflict);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 650));
        } catch (err) {
          console.error(chalk.yellow(`[!] Error testing batch: ${err.message}`));
        }
      }
      await page.close();
    };

    // Remove bad params and retry
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
  for (const [url, params] of Object.entries(globalResults)) {
    if (params.length > 0) {
      console.log(chalk.greenBright(`✅ ${url}: ${params.join(', ')}`));
    }
  }
  
  if (badParams.size > 0) {
    console.log(chalk.redBright(`\n⚠️  Conflicting parameters: ${[...badParams].join(', ')}`));
  }
})();