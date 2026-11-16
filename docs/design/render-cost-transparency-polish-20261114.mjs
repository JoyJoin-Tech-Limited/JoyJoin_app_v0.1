import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.resolve(root, 'docs/design/cost-transparency-polish-20261114.html');
const pngPath = path.resolve(root, 'docs/design/cost-transparency-polish-20261114.png');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    locale: 'zh-CN',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: pngPath, fullPage: false });
  const png = await readFile(pngPath);
  console.log(JSON.stringify({
    output: path.relative(root, pngPath),
    cssViewport: '375x812',
    deviceScaleFactor: 3,
    pixelWidth: png.readUInt32BE(16),
    pixelHeight: png.readUInt32BE(20),
  }, null, 2));
} finally {
  await browser.close();
}
