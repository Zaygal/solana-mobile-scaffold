// Render the deck: one PNG per slide plus a single PDF.
// Runs on a GitHub runner (see .github/workflows/deck.yml) so nothing is installed
// locally. Chromium's rendering is the output, which is why the deck and the app
// being built with the same toolchain matters: one consistent thing.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const OUT = 'out';
mkdirSync(OUT, { recursive: true });

// Read width/height straight out of a PNG's IHDR. A screenshot call returning
// without throwing is not evidence the image is the right size, and a deck slide
// rendered at the wrong dimensions is not something to discover in front of a judge.
function pngSize(file) {
  const b = readFileSync(file);
  if (b.slice(1, 4).toString() !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

const url = 'file://' + path.resolve('deck/deck.html');
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const slides = await page.$$('.slide');
console.log(`slides found: ${slides.length}`);
if (slides.length !== 10) {
  throw new Error(`expected 10 slides, found ${slides.length}`);
}

for (let i = 0; i < slides.length; i++) {
  const file = path.join(OUT, `slide-${String(i + 1).padStart(2, '0')}.png`);
  await slides[i].screenshot({ path: file, type: 'png' });
  const { w, h } = pngSize(file);
  if (w !== 1920 || h !== 1080) throw new Error(`${file} rendered ${w}x${h}, not 1920x1080`);
  console.log(`  ${path.basename(file)}  ${w}x${h}  ${statSync(file).size} bytes`);
}

// PDF: one slide per page. The @page size must match the slide box or Chromium
// repaginates and splits a slide across two pages.
await page.addStyleTag({ content: '@page { size: 1920px 1080px; margin: 0; }' });
const pdf = path.join(OUT, 'clock-in-deck.pdf');
await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true });
console.log(`  ${path.basename(pdf)}  ${statSync(pdf).size} bytes`);

await browser.close();

// Report what is actually on disk rather than what was intended.
const pngs = readdirSync(OUT).filter((f) => f.endsWith('.png'));
console.log(`\nwrote ${pngs.length} PNGs and 1 PDF into ${OUT}/`);
if (pngs.length !== 10) throw new Error(`expected 10 PNGs on disk, found ${pngs.length}`);
