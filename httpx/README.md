# headless-httpx

A powerful, headless browser-based URL scanner built with Node.js and Puppeteer inspired from Project Discovery's httpx.  
Designed for bypassing WAFs and capturing response metadata and screenshots.

## 🚀 Features

- Real browser-based HTTP requests (via Puppeteer)
- Optional screenshot capture (`-ss`)
- Displays status code (`-sc`) and content length (`-cl`)
- Supports HTTP proxies (`-p`)
- Multi-threaded with configurable concurrency (`-w`)
- Generates a clean HTML report with screenshot thumbnails
- Accepts input from a file or standard input (stdin)

---
## Why did I create this tool?
I was doing Bug Bounty Recon with httpx and I run httpx with the screenshot feature. When I analized the results I noticed there were a lot of 403s on my status codes, specially with services behind CloudFlare. I noticed though that the Screenshots didn't show CloudFlare's Forbidden message. Therefore I thought that httpx raw HTTP requests were being banned but headless HTTP requests didn't. I use quite a lot httpx and I wasn't happy with the idea that I was being banned frequently, so I created this simple script to help bypass WAFs with the same functionalities I mostly use from httpx.

## Comparison with Project Discovery's httpx
Comparison scanning the same urls:
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
It's not perfect but it's a huge difference. Of course it is slower that normal httpx, but I personally prefer being slower rather than scanning multiple times to obtain the real result.
## 📦 Installation

```bash
git clone https://github.com/yourusername/headless-httpx.git
cd headless-httpx
npm install
```