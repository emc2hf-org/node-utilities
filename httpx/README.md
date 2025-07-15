# headless-httpx

A powerful headless browser-based URL scanner built with Node.js and Puppeteer, inspired by ProjectDiscovery's [`httpx`](https://github.com/projectdiscovery/httpx).  
Designed to bypass WAFs and capture response metadata and screenshots using real browser behavior.

---

## 🚀 Features

- Real browser-based HTTP requests (via Puppeteer)
- Optional screenshot capture (`-ss`)
- Displays status code (`-sc`) and content length (`-cl`)
- Supports HTTP proxies (`-p`)
- Multi-threaded with configurable concurrency (`-w`)
- Generates a clean HTML report with screenshot thumbnails
- Accepts input from a file or standard input (stdin)

---
## ❓ Why Did I Create This Tool?
I was doing Bug Bounty Recon phase with httpx and I ran httpx with the screenshot feature. When I analyzed the results, I noticed there were a lot of 403s in my status codes, especially with services behind Cloudflare. I noticed, though, that the screenshots didn't show Cloudflare's Forbidden message. Therefore, I thought that httpx's raw HTTP requests were being banned, but headless HTTP requests were not. I use httpx quite a lot, and I wasn't happy with the idea that I was being banned frequently, so I created this simple script to help bypass WAFs with the same functionalities I mostly use from httpx.

## 🔍 Comparison with Project Discovery's httpx
Scanning the same list of URLs:
### httpx
```bash
cat httpx/northwestern_results.txt | grep -F '[403]' | wc -l
100
```
### headless-httpx
```bash
cat northwestern_resutls.txt | grep -F '[403]' | wc -l
7 
```

It's not perfect, but it's a huge difference. Of course, it is slower than normal httpx, but I personally prefer being slower rather than scanning multiple times to obtain the real result.

---
## 📦 Installation

```bash
git clone https://github.com/yourusername/headless-httpx.git
cd headless-httpx
npm install
```
---
## 🛠 Usage
```bash
node httpx.mjs -l urls.txt [options]
```
Or via stdin:
```bash
cat urls.txt | node httpx.mjs [options]
```

## 🔮 Future Work
- Study and implement WAF bypass techniques
- Correct [ERROR] status requests
- Add retry logic for timeouts or failed requests
- Implement filtering based on status codes or content length

### 🛡️ WAF Bypass Techniques (Planned)
- Randomize User-Agent and other headers per request
- Use stealth plugins like `puppeteer-extra-plugin-stealth`