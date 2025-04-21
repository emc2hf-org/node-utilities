import fs from 'fs';
import puppeteer from 'puppeteer';
import chalk from 'chalk';
import path from 'path';
import { mkdir } from 'fs/promises';

function checkUnique(currentParam, paramBatch, content, markerPrefix) {
    // Find all longer parameters in the batch that contain currentParam
    const longerParams = paramBatch.filter(p => 
        p.length > currentParam.length && p.includes(currentParam)
    );
    
    // Check if any of the longer parameters' markers exist in content
    for (const longerParam of longerParams) {
        const longerMarker = `${markerPrefix}${longerParam}`;
        if (content.includes(longerMarker)) {
            return false; // Longer param's marker exists, current is not unique
        }
    }
    
    // No longer params' markers found, check current param's marker
    const currentMarker = `${markerPrefix}${currentParam}`;
    return content.includes(currentMarker);
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
const saveResponses = hasFlag('-r');

const CONCURRENT_WORKERS = parseInt(workerCountArg) || 5;
const MAX_URL_LENGTH = 2000; // Original: 2000
const markerPrefix = 'xSsFOUND123';

if (!paramFilePath || !urlFilePath) {
  console.error(chalk.red('Usage: node xss_param_fuzzer_headless.mjs -pf params.txt -uf urls.txt [-w 10] [-p http://127.0.0.1:8080] [-s]'));
  process.exit(1);
}

const paramNames = fs.readFileSync(paramFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);
const targetUrls = fs.readFileSync(urlFilePath, 'utf-8').split(/\r?\n/).filter(Boolean);

const buildUrlWithParams = (baseUrl, paramGroup) => {
  const params = paramGroup.map(p => `${encodeURIComponent(p)}=${markerPrefix}${p}`).join('&');
  return `${baseUrl}?${params}`;
};

const splitIntoUrlSafeBatches = (params, baseUrl) => {
  const batches = [];
  let currentBatch = [];
  let currentLength = baseUrl.length + 1;

  for (const param of params) {
    const entry = `${encodeURIComponent(param)}=${markerPrefix}${param}`;
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
};

const sanitize = str => str.replace(/[^a-zA-Z0-9-_]/g, '_');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const puppeteerArgs = [];
  const globalResults = {}; // For final report
  const globalRedirects = {};

  if (proxyArg) {
    puppeteerArgs.push(`--proxy-server=${proxyArg}`);
    console.log(chalk.cyan(`[*] Using proxy: ${proxyArg}`));
  }

  if (saveResponses) {
    await mkdir('responses', { recursive: true });
  }
  if (takeScreenshots) {
    await mkdir('screenshots', { recursive: true });
    console.log(chalk.cyan(`[*] Screenshots enabled`));
  }

  puppeteerArgs.push(`--ignore-certificate-errors`);
  const browser = await puppeteer.launch({ headless: false, args: puppeteerArgs });

  for (const baseUrl of targetUrls) {
    console.log(chalk.magentaBright(`\n🔍 Testing URL: ${baseUrl}`));

    const results = [];
    let redirect;
    const batches = splitIntoUrlSafeBatches(paramNames, baseUrl);

    const runWorker = async (batchGroup) => {
      const page = await browser.newPage();
      const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';
      // Set custom user agent
      await page.setUserAgent(customUA);
      for (const paramBatch of batchGroup) {
        const testUrl = buildUrlWithParams(baseUrl, paramBatch);
        // console.log(chalk.grey(`[i] ParamBatch: ${testUrl}`))
        try {
          const response = await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 0 }); // original: networkidle0
          // optimum: domcontentloaded
          
          if (!response.ok()) {
            console.log(chalk.red(`Aborting Request => Status Code ${response.status()}`));
            console.log(chalk.red(`Aborting Request => Headers:`),response.headers());
            console.log(chalk.red(`Aborting Request => Content ${await response.text()}`));
            process.exit(1);
          }
          
         
          // TODO OPTIMIZATION: be sure that the content left to charge is not from images and other kind of staff that have nothing to do with param reflection
          let content;
          let contentLength = 0;
          let counter = 0;
          let firstPageContent;
          
          while (!firstPageContent) {
            try {
              // First load page as DOMContentLoaded
              // Avoids redirect
              firstPageContent = await page.content(); 
            }
            catch(err) {}
          }

          while (counter < 10) {
            try {
              // Complete loaded page (follows client-side redirects)
              content = await page.content();
            } catch(err) {}
            finally {
              if (content) {
                if (contentLength === content.length) {
                  counter ++;
                  // console.log(`Counter: ${counter}`);
                } 
                else {
                  await sleep(750);
                  contentLength = content.length;
                  counter = 0;
                }
              }

              if (page.url() !== testUrl) {
                redirect = page.url();
                content = firstPageContent
                break;
              } else {
                // Pre: si el url és el mateix SEMPRE tindrà content, per tant no cal que entri al if
                firstPageContent = content;
              }
            }
          }
          

          let tookScreenshot = false;

          for (const param of paramBatch) {
            const marker = `${markerPrefix}${param}`;
            if (checkUnique(param, paramBatch, content, markerPrefix)) {
              // console.log(chalk.yellow`[i] paramBatch: ${paramBatch}`)
              console.log(chalk.green(`[+] Reflected in DOM: ${param}`));
              results.push(param);

              if (saveResponses) {
                // Generate safe names with domain underscores
                const hostname = new URL(baseUrl).href.substring(8).replace(/\./g, '_');
                const safeName = sanitize(`${hostname}_${param}`); // <-- MODIFIED

                // Save response
                const responseFilename = path.join('responses', `${safeName}.html`);
                fs.writeFileSync(responseFilename, content);
                console.log(chalk.blue(`[📄] Response saved: ${responseFilename}`));
              }

              // Save screenshot
              if (!tookScreenshot && takeScreenshots) {
                const screenshotFilename = path.join('screenshots', `${safeName}.png`);
                await page.screenshot({ path: screenshotFilename, fullPage: true });
                console.log(chalk.blue(`[📸] Screenshot saved: ${screenshotFilename}`));
                tookScreenshot = true;
              }
            }
          }
          await sleep(750);
        }
        catch (err) {
          console.error(chalk.yellow(`[!] Error testing batch: ${err.message}`));
          process.exit(1);
        }
      }
      await page.close();
    };

    const batchGroups = Array.from({ length: CONCURRENT_WORKERS }, () => []);
    batches.forEach((batch, i) => {
      batchGroups[i % CONCURRENT_WORKERS].push(batch);
    });

    console.log(chalk.cyan(`[*] Fuzzing ${paramNames.length} params in ${batches.length} batches with ${CONCURRENT_WORKERS} workers...\n`));

    await Promise.all(batchGroups.map(group => runWorker(group)));

    

    if (redirect) {
      // Store results for final report
      globalRedirects[baseUrl] = redirect;
      console.log(chalk.grey(`\n[↪] Redirect found for ${baseUrl} => ${redirect}`));
    }

    if (results.length > 0) {
      // Store results for final report
      globalResults[baseUrl] = results;
      console.log(chalk.greenBright(`\n✅ Reflected parameters for ${baseUrl}: ${results.join(', ')}`));
    } else {
      console.log(chalk.gray(`\n❌ No reflected parameters found for ${baseUrl}`));
    }
  }

  await browser.close();

  // FINAL REPORT
  console.log(chalk.magentaBright('\n=== FINAL RESULTS ==='));
  // Redirects
  console.log(chalk.magentaBright('--- Redirects ---'));
  for (const [url, redirect] of Object.entries(globalRedirects)) {
    console.log(chalk.grey(`[↪] Redirect found for ${url} => ${redirect}`));
  }
  // Parameters
  console.log(chalk.magentaBright('--- Parameters ---'));
  for (const [url, params] of Object.entries(globalResults)) {
    console.log(chalk.greenBright(`✅ Reflected parameters for ${url}: ${params.join(', ')}`));
    }
})();