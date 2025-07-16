# Node.js Recon Tools for Web Fuzzing

This repository contains a collection of **Node.js-based recon tools** designed to assist in web fuzzing, especially for bug bounty hunting and penetration testing. The tools simulate real browser behavior using **Puppeteer**, making them ideal for bypassing WAFs, handling JavaScript-heavy applications, and discovering misbehaving parameters.

---

## 📦 Tools Included

### 1. [`DOM_param_fuzzer.mjs`](./dom-param-fuzzer/)
### ⚠️ Under development

This tool injects custom markers into URL parameters and detects which ones are **reflected in the DOM**. It’s particularly useful for identifying potential DOM XSS vectors before redirects.

**Features:**
- Uses **Puppeteer** for real browser interaction
- Detects DOM-reflected parameters
- Handles JavaScript-based redirects
- Supports:
    - Proxy usage
    - Response saving
    - Screenshot saving
    - Multi-threading with workers

**Usage:**

```bash
node xss_param_fuzzer_headless.mjs -pf params.txt -uf urls.txt [-w 10] [-p http://127.0.0.1:8080] [-s] [-r]
```
#### 🧰 Arguments
| Flag   | Description                                            |
|--------|--------------------------------------------------------|
| `-pf`  | Path to parameter wordlist                             |
| `-uf`  | Path to list of base URLs                              |
| `-w`   | Number of concurrent workers (default: 5)             |
| `-p`   | Optional proxy (e.g., `http://127.0.0.1:8080`)        |
| `-s`   | Save screenshots where reflections occur               |
| `-r`   | Save HTML response where reflections occur             |

### 2. [`bad_params.mjs`](./dom-param-fuzzer/)
### ⚠️ Under development
This tool uses a binary search method to identify **"bad" parameters** (parameters that cause redirects, status code changes, or abnormal behaviors in the web application). Great for finding parameter-based WAF blocks or filters and special parameters used by the server.

**Features:**
- Uses **Puppeteer** to simulate real browser requests
- Detects parameter conflicts via status code deviation
- Binary search for optimal performance
- Supports proxy and concurrent workers

**Usage:**

```bash
node status_param_fuzzer_headless.mjs -pf params.txt -uf urls.txt [-w 10] [-p http://127.0.0.1:8080]
```
#### 🧰 Arguments

| Flag   | Description                                            |
|--------|--------------------------------------------------------|
| `-pf`  | Path to parameter wordlist                             |
| `-uf`  | Path to list of base URLs                              |
| `-w`   | Number of concurrent workers (default: 5)             |
| `-p`   | Optional proxy (e.g., `http://127.0.0.1:8080`)        |

### 3. [`httpx.mjs`](./httpx/)
A powerful headless browser-based URL scanner built with Node.js and Puppeteer, inspired by ProjectDiscovery's [`httpx`](https://github.com/projectdiscovery/httpx).  
Designed to bypass WAFs and capture response metadata and screenshots using real browser behavior.

**Features:**
- Real browser-based HTTP requests (via Puppeteer)
- Optional screenshot capture (`-ss`)
- Displays status code (`-sc`) and content length (`-cl`)
- Supports HTTP proxies (`-p`)
- Multi-threaded with configurable concurrency (`-w`)
- Generates a clean HTML report with screenshot thumbnails
- Accepts input from a file or standard input (stdin)

**Usage:**
```bash
node httpx.mjs -l urls.txt [options]
```
Or via stdin:
```bash
cat urls.txt | node httpx.mjs [options]
```
#### 🧰 Arguments

| Flag | Description                                                                                  |
|----|----------------------------------------------------------------------------------------------|
| `-l <file>` | Path to a file containing URLs (one per line). If not provided, URLs can be piped via stdin  |
| `-sc` | Show HTTP **status code** in output                                                          |
| `-cl` | Show **content length** for each URL                                                         |
| `-ss` | Take **screenshots** of each page and generate an HTML report in the `screenshots/` folder   |
| `-p <proxy>` | Optional proxy (e.g., `http://127.0.0.1:8080`)                                               |
| `-w <workers>` | Number of concurrent **workers/pages** to use (default: 5)                                   |
| `-hs` | Run Puppeteer in headless mode (by default it runs non-headless mode to minimize WAF blocks) |
| `-o <output_file>` | Write raw output (status, length, etc.) to the specified file |
