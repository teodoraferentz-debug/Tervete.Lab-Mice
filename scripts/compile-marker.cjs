/**
 * Compiles the AR image target (public/assets/markers/tervete-map.mind) from the map texture, using
 * MindAR's own compiler in headless Chromium. The result must be made from the SAME image that is
 * printed, so tracking and the 3D map line up.
 *
 *   npm i -D playwright            (once; not a project dependency)
 *   npm run dev                    (in another terminal, port 5173)
 *   node scripts/compile-marker.cjs
 *
 * Alternative without Playwright: https://hiukim.github.io/mind-ar-js-doc/tools/compile
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'assets', 'markers', 'tervete-map.mind');
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => console.log('pageerror:', e.message));
  page.on('console', m => { if (/progress/.test(m.text())) console.log(m.text()); });
  await page.goto('http://127.0.0.1:5173/');
  const b64 = await page.evaluate(async () => {
    const { Compiler } = await import('/node_modules/mind-ar/dist/mindar-image.prod.js');
    const src = new Image(); src.src = '/assets/illustrations/tervete-map.webp'; await src.decode();
    // 1400 px wide is plenty for tracking and keeps the compiled file small
    const c = document.createElement('canvas'); c.width = 1400; c.height = Math.round(1400 * src.naturalHeight / src.naturalWidth);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    const img = new Image(); img.src = c.toDataURL('image/png'); await img.decode();
    const comp = new Compiler();
    await comp.compileImageTargets([img], (p) => { if (Math.round(p) % 20 === 0) console.log('progress', Math.round(p)); });
    const buf = await comp.exportData();
    const u = new Uint8Array(buf); let s = '';
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
    return btoa(s);
  });
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log('mind bytes', fs.statSync(OUT).size);
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
