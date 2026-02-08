import { chromium } from 'playwright';

const outDir = '/home/dark/Desktop/Projects/ProofMesh/images/social-real-frames';
const url = 'http://127.0.0.1:3010/social-gif';
const totalFrames = 150;
const frameDelayMs = 66;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(2000);

const root = await page.$('main');
if (!root) throw new Error('No se encontro el contenedor principal');
const box = await root.boundingBox();
if (!box) throw new Error('No se pudo medir el contenedor');

const bell = page.locator('button:has(svg.lucide-bell)').first();
const starButtons = page.locator('button:has(svg.lucide-star)');
const commentButtons = page.locator('button:has(svg.lucide-message-square)');

for (let i = 0; i < totalFrames; i++) {
  if (i === 12) await bell.click({ force: true });
  if (i === 28) await bell.click({ force: true });
  if (i === 40) await starButtons.nth(0).click({ force: true });
  if (i === 56) await commentButtons.nth(0).hover();
  if (i === 68) await starButtons.nth(1).click({ force: true });
  if (i === 86) await commentButtons.nth(1).hover();
  if (i === 102) await bell.click({ force: true });
  if (i === 116) await bell.click({ force: true });

  const phase = Math.floor((i / totalFrames) * 6);
  const points = [
    { x: box.x + 1450, y: box.y + 60 },
    { x: box.x + 540, y: box.y + 380 },
    { x: box.x + 1010, y: box.y + 370 },
    { x: box.x + 540, y: box.y + 690 },
    { x: box.x + 1010, y: box.y + 690 },
    { x: box.x + 1450, y: box.y + 60 },
  ];
  const p = points[Math.min(phase, points.length - 1)];
  await page.mouse.move(p.x + Math.sin(i / 4) * 10, p.y + Math.cos(i / 5) * 8, { steps: 2 });

  const path = `${outDir}/frame-${String(i).padStart(4, '0')}.png`;
  await page.screenshot({
    path,
    clip: {
      x: Math.floor(box.x),
      y: Math.floor(box.y),
      width: Math.floor(box.width),
      height: Math.floor(Math.min(860, box.height)),
    },
  });
  await page.waitForTimeout(frameDelayMs);
}

await browser.close();
