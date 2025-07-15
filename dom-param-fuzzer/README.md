# 🕵️ DOM Parameter Fuzzer & Bad Parameter Finder

Two powerful Node.js tools designed for bug bounty hunters, penetration testers, and researchers:

1. **DOM Parameter Fuzzer**: Detects reflected parameters in the DOM (ideal for XSS reconnaissance).
2. **Bad Parameter Finder**: Identifies parameters that break a web application's response (e.g., change status codes), using binary search.

Both tools leverage **headless Chrome (Puppeteer)** to behave like real browsers, increasing detection accuracy and bypassing WAF-based filtering.

# ⚠️ These tools are just a PoC and are still in development

---

## 📦 Install

```bash
git clone https://github.com/yourusername/headless-httpx.git
cd dom-param-fuzzer
npm install
```
(You must have Node.js and Chromium/Chrome installed. Puppeteer downloads Chromium by default.)

---
## 1️⃣ DOM Parameter Fuzzer
### 🔍 Description
This tool injects custom markers into parameters and identifies which ones are reflected in the DOM. It uses Puppeteer to simulate real browser requests, helping you bypass WAFs or JavaScript-heavy apps.

It is designed to detect parameters before a redirect occurs, as some websites use JavaScript redirects to send you to a new site while still serving the old one. This tool renders the first page it visits and saves the results before any redirect takes place.

### 🧪 Use Case
- Identify potential XSS injection points.
- Discover reflected parameters client-side.
- Discover reflected parameters before a redirect chain.

### ▶️ Usage
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

### 🧠 How It Works
- Batches parameters to respect URL length limits.
- Injects unique marker into each parameter.
- Loads the page and checks if the marker appears in the DOM.
- Compares site loading and detects the loaded page before a redirect occurs.
- Saves evidence (screenshot and/or HTML) when found.

## 2️⃣ Bad Parameter Finder
### 🔍 Description
This tool helps you detect **"bad" parameters** that interfere with the site causing errors, blocks, or altered behavior. It uses a binary search algorithm to efficiently isolate problematic parameters from a large list. The most common case of this are Amazon S3 servers.
### 🧪 Use Case
- Identify WAF-tripping or sensitive parameters.
- Reduce false negatives in parameter fuzzing.
- Clean your wordlists dynamically.

### Usage
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

### 🧠 How It Works
- Sends full batches of parameters.
- If non-200 status is returned, it uses binary search to isolate the conflicting parameter.
- Helps clean parameter lists that may be blocked or cause unintended side effects.

## 🔐 Disclaimer
These tools are for educational and authorized testing purposes only. Do not use it against systems you don’t have explicit permission to test.