import { chromium } from 'playwright';
import fs from 'fs/promises';

const outDir = '/home/dark/Desktop/Projects/ProofMesh/images/landing-frames';
const url = 'http://127.0.0.1:3010';
const totalFrames = 120;
const frameDelayMs = 66;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

const panelHandle = await page.evaluateHandle(() => {
  const sections = document.querySelectorAll('section');
  const interactive = sections[1];
  if (!interactive) return null;
  return interactive.querySelector('div.relative.rounded-xl.border');
});

const panel = panelHandle.asElement();
if (!panel) throw new Error('No encontre el panel animado en la landing.');

await panel.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);

const box = await panel.boundingBox();
if (!box) throw new Error('No se pudo obtener bounding box del panel.');

for (let i = 0; i < totalFrames; i++) {
  const path = `${outDir}/frame-${String(i).padStart(4, '0')}.png`;
  await page.screenshot({
    path,
    clip: {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.floor(box.width),
      height: Math.floor(box.height),
    },
  });
  await page.waitForTimeout(frameDelayMs);
}

await browser.close();
await fs.writeFile('/home/dark/Desktop/Projects/ProofMesh/images/landing-frames/.done', 'ok');
