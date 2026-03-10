---
name: ship
description: Run code checks, headless browser tests, and deploy to Vercel production
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep, Edit
---

# Ship: Test & Deploy Pipeline

Run the full develop → test → deploy pipeline for the Little Something app. Fix any issues found before deploying.

## Step 1: Static Checks

### JS Syntax
```bash
node --check script.js
```

### HTML ↔ JS ID Cross-Check
Verify every `getElementById('xxx')` in `script.js` has a matching `id="xxx"` in `app.html`. Report any mismatches.

```bash
python3 -c "
import re
with open('app.html') as f: html = f.read()
with open('script.js') as f: js = f.read()
ids_js = set(re.findall(r\"getElementById\(['\\\"]([^'\\\"]+)['\\\"]\)\", js))
ids_html = set(re.findall(r'id=\"([^\"]+)\"', html))
missing = ids_js - ids_html
if missing:
    print('FAIL: IDs in JS but missing from HTML:')
    for m in sorted(missing): print(f'  - {m}')
    exit(1)
else:
    print(f'PASS: All {len(ids_js)} JS element refs exist in HTML')
"
```

If any check fails, stop and fix the issue before continuing.

## Step 2: Headless Browser Tests

Install puppeteer if needed (`npm ls puppeteer || npm install puppeteer`), then run a comprehensive test using a local server + headless Chrome.

Start a local Python HTTP server in the background, then run this test script:

```javascript
// test_ship.mjs — write this file, run it, then delete it
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.setViewport({ width: 390, height: 844 });
await page.goto('http://localhost:8765/app.html', { waitUntil: 'networkidle2', timeout: 10000 });
await new Promise(r => setTimeout(r, 1000));

const results = [];
function assert(name, ok) { results.push({ name, ok }); if (!ok) console.log('  FAIL: ' + name); }

// T1: Bubbles render
const bubbleCount = await page.$$eval('.bubble', els => els.length);
assert('Bubbles rendered', bubbleCount > 0);

// T2: FAB button clickable (not blocked by overlays)
const fabHit = await page.evaluate(() => {
  const fab = document.getElementById('fab-create');
  const r = fab.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return el?.id;
});
assert('FAB not blocked by overlay', fabHit === 'fab-create');

// T3: FAB navigates to create
await page.click('#fab-create');
await new Promise(r => setTimeout(r, 500));
let view = await page.evaluate(() => state.currentView);
assert('FAB → create screen', view === 'create');

// T4: Save a moment
await page.type('#moment-text', 'Ship test moment');
await page.click('#btn-save-moment');
await new Promise(r => setTimeout(r, 800));
view = await page.evaluate(() => state.currentView);
assert('Save → back to home', view === 'home');

// T5: Bubble click opens detail
const bubbles = await page.$$('.bubble');
if (bubbles.length > 0) {
  await bubbles[0].click();
  await new Promise(r => setTimeout(r, 500));
  const detailVis = await page.evaluate(() =>
    document.getElementById('overlay-detail').classList.contains('visible')
  );
  assert('Bubble click → detail opens', detailVis);

  // T6: Close detail
  await page.click('#btn-detail-back');
  await new Promise(r => setTimeout(r, 300));
  const detailClosed = await page.evaluate(() =>
    !document.getElementById('overlay-detail').classList.contains('visible')
  );
  assert('Detail close works', detailClosed);
}

// T7: Tab navigation
await page.click('#tab-bottle');
await new Promise(r => setTimeout(r, 500));
view = await page.evaluate(() => state.currentView);
assert('Tab → bottle screen', view === 'bottle');

await page.click('#tab-home');
await new Promise(r => setTimeout(r, 500));
view = await page.evaluate(() => state.currentView);
assert('Tab → home screen', view === 'home');

// T8: No JS errors
assert('No page errors', errors.length === 0);

// Summary
const passed = results.filter(r => r.ok).length;
const total = results.length;
console.log(`\n${passed}/${total} tests passed`);
if (passed < total) {
  results.filter(r => !r.ok).forEach(r => console.log('  FAIL: ' + r.name));
  process.exit(1);
}
if (errors.length) {
  console.log('Page errors:', errors);
  process.exit(1);
}
console.log('All tests passed');

await browser.close();
```

### How to run:
1. Start local server: `python3 -c "import http.server,socketserver,os,threading; os.chdir('.'); httpd=socketserver.TCPServer(('',8765),http.server.SimpleHTTPRequestHandler); t=threading.Thread(target=httpd.serve_forever,daemon=True); t.start(); import time; time.sleep(999)" &`
2. Write the test script to `test_ship.mjs`
3. Run: `node test_ship.mjs`
4. Kill server: `kill %1 2>/dev/null`
5. Clean up: `rm -f test_ship.mjs`

If any test fails, diagnose and fix the code, then re-run from Step 1.

## Step 3: Deploy to Vercel

Only run this after all tests pass.

```bash
~/.local/bin/vercel --prod --yes
```

## Step 4: Smoke Test Production

Run a quick subset of tests against the live URL `https://littlesomething-xi.vercel.app/` to confirm the deployment works:
- FAB button not blocked
- Navigation works
- No JS page errors

Use the same Puppeteer pattern but pointing to the production URL.

## Step 5: Report

Print a summary:
- Static checks: pass/fail
- Local tests: N/N passed
- Deploy: success + URL
- Production smoke: pass/fail
