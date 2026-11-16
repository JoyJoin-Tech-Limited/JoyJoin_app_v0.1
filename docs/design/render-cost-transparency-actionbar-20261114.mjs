// 底部动作条（紧凑单行）审批证据：窄屏 / 长金额 / 安全区
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = 'file://' + path.join(dir, 'cost-transparency-polish-20261114.html');

const variants = [
  { name: '320', width: 320, height: 568, dsf: 3, longValue: null },
  { name: '320-long-value', width: 320, height: 568, dsf: 3, longValue: '已含在权益里' },
  { name: '375-long-value', width: 375, height: 812, dsf: 3, longValue: '已含在权益里' },
  { name: '393-safearea', width: 393, height: 852, dsf: 3, longValue: null },
];

const browser = await chromium.launch();
for (const v of variants) {
  const page = await browser.newPage({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dsf,
  });
  await page.goto(html);
  // 打磨稿本身锁定了 375px 画布；响应式证据必须解除画框，否则量到的是画框不是布局
  await page.addStyleTag({ content: 'html, body { width: 100%; height: 100%; }' });
  if (v.longValue) {
    await page.evaluate((text) => {
      const el = document.querySelector('.actionbar__price-value');
      if (el) el.textContent = text;
    }, v.longValue);
  }
  await page.screenshot({
    path: path.join(dir, `cost-transparency-actionbar-${v.name}-20261114.png`),
    clip: { x: 0, y: v.height - 150, width: v.width, height: 150 },
  });
  const metrics = await page.evaluate(() => {
    const bar = document.querySelector('.actionbar');
    const cta = document.querySelector('.actionbar .cta, .actionbar button, .actionbar__cta');
    const price = document.querySelector('.actionbar__price-value');
    const r = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
    return {
      viewport: window.innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      bar: r(bar),
      cta: r(cta),
      price: r(price),
      ctaFont: cta ? getComputedStyle(cta).fontSize + ' / ' + getComputedStyle(cta).fontWeight : null,
    };
  });
  console.log(v.name, JSON.stringify(metrics));

  if (v.width === 320) {
    await page.screenshot({
      path: path.join(dir, `cost-transparency-polish-${v.name}-20261114.png`),
    });
    // 内容可达性：滚到底后，合计与「费用怎么算」必须完整位于动作条之上
    await page.evaluate(() => {
      const c = document.querySelector('.content');
      if (c) c.scrollTop = c.scrollHeight;
    });
    await page.screenshot({
      path: path.join(dir, `cost-transparency-polish-${v.name}-scrolled-20261114.png`),
    });
    const reachability = await page.evaluate(() => {
      const c = document.querySelector('.content');
      const link = document.querySelector('.cost-link');
      const bar = document.querySelector('.actionbar');
      const lr = link.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      return {
        contentScrollable: c.scrollHeight > c.clientHeight,
        linkBottom: lr.bottom,
        barTop: br.top,
        linkFullyAboveBar: lr.bottom <= br.top + 0.5,
      };
    });
    console.log(`${v.name} reachability`, JSON.stringify(reachability));

    if (v.name === '320') {
      // 卡片区证据：展开主内容并隐藏动作条，避免固定/滚动容器造成重复或裁切
      await page.evaluate(() => { document.querySelector('.content').scrollTop = 0; });
      await page.addStyleTag({ content: '.actionbar{display:none} .content{overflow:visible;height:auto;flex:none} html,body{height:auto}' });
      const box = await page.evaluate(() => {
        const el = document.querySelector('.ticket');
        return el ? el.getBoundingClientRect().toJSON() : null;
      });
      if (box) {
        await page.screenshot({
          path: path.join(dir, 'cost-transparency-card-320-20261114.png'),
          clip: { x: 0, y: Math.max(0, box.y - 8), width: v.width, height: box.height + 16 },
          fullPage: true,
        });
      }
    }
  }
  await page.close();
}
await browser.close();
