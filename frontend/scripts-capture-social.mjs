import { chromium } from 'playwright';

const outDir = '/home/dark/Desktop/Projects/ProofMesh/images/social-frames';
const url = 'http://127.0.0.1:3010';
const totalFrames = 135; // 9s @15fps
const frameDelayMs = 66;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

// Scroll to social section
await page.evaluate(() => {
  const el = document.querySelector('#community');
  if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
});
await page.waitForTimeout(700);

// Make pointer visible for "interaction" feeling
await page.addStyleTag({
  content: `
    * { cursor: none !important; }
    #pm-cursor {
      position: fixed;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 2px solid rgba(79,70,229,.9);
      background: rgba(255,255,255,.95);
      box-shadow: 0 0 0 8px rgba(79,70,229,.13);
      z-index: 2147483647;
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: transform 80ms linear;
    }
  `,
});
await page.evaluate(() => {
  const c = document.createElement('div');
  c.id = 'pm-cursor';
  c.style.left = '100px';
  c.style.top = '100px';
  document.body.appendChild(c);
});

const sectionHandle = await page.$('#community');
if (!sectionHandle) throw new Error('No encontre #community');
const box = await sectionHandle.boundingBox();
if (!box) throw new Error('No se pudo medir #community');

const moves = [
  { x: box.x + 220, y: box.y + 210 }, // feed card 1
  { x: box.x + 250, y: box.y + 300 }, // feed card 2
  { x: box.x + 265, y: box.y + 390 }, // feed card 3
  { x: box.x + 980, y: box.y + 220 }, // thread card
  { x: box.x + 980, y: box.y + 385 }, // snapshot card
  { x: box.x + 720, y: box.y + 135 }, // center title
];

await page.mouse.move(moves[0].x, moves[0].y);

for (let i = 0; i < totalFrames; i++) {
  const phase = Math.floor((i / totalFrames) * moves.length);
  const target = moves[Math.min(phase, moves.length - 1)];

  const jitterX = Math.sin(i / 6) * 6;
  const jitterY = Math.cos(i / 7) * 5;
  const x = target.x + jitterX;
  const y = target.y + jitterY;

  await page.mouse.move(x, y, { steps: 2 });
  if (i % 24 === 0) {
    await page.mouse.down();
    await page.waitForTimeout(20);
    await page.mouse.up();
  }

  await page.evaluate(({ x, y }) => {
    const c = document.getElementById('pm-cursor');
    if (!c) return;
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
  }, { x, y });

  const path = `${outDir}/frame-${String(i).padStart(4, '0')}.png`;
  await page.screenshot({
    path,
    clip: {
      x: Math.max(0, Math.floor(box.x - 10)),
      y: Math.max(0, Math.floor(box.y - 10)),
      width: Math.floor(Math.min(1360, box.width + 20)),
      height: Math.floor(Math.min(820, box.height + 20)),
    },
  });

  await page.waitForTimeout(frameDelayMs);
}

await browser.close();
