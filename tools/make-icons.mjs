/**
 * Regenerates the launcher icons from the source portrait.
 *
 * The photo is reduced to a continuous duotone: luminance is mapped onto a ramp
 * that runs base -> work violet -> white, so the shot's near-black background
 * falls away onto the app's own base colour and the face is left as flat-ish
 * colour in the brand hue. Nothing is masked by hand — the lighting did it.
 *
 *   node tools/make-icons.mjs [outRoot]
 *
 * `outRoot` defaults to the repo root. Pass a scratch directory to preview a
 * change without touching android/.
 *
 * Requires sharp (devDependency). The android/ project is hand-maintained, so
 * this writes the mipmaps in place and never runs prebuild.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || REPO);

const SRC = join(REPO, 'assets/7baca60d448a04cb836c11ba3a3c70e3.jpg');

/**
 * Square crop on the 476x593 source, framed off the face: hair to a little
 * below the collar, with the eyes about a third of the way down.
 */
const CROP = { left: 5, top: 45, width: 450, height: 450 };

const BASE = [0x0e, 0x0e, 0x10];
const VIOLET = [0x7c, 0x5c, 0xff];
const WHITE = [0xff, 0xff, 0xff];

/**
 * Fraction of the adaptive layer the artwork occupies. Android guarantees only
 * the middle 72dp of the 108dp layer survives the launcher's mask, so the
 * portrait is sized to that and the margin is left transparent — the adaptive
 * background is #0E0E10, the same colour the photo fades to.
 */
const SAFE = 72 / 108;

const lerp = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));

/** Luminance 0-255 to a point on the base -> violet -> white ramp. */
function ramp(v) {
  const t = Math.min(1, Math.max(0, (v - 30) / 200));
  return t < 0.55 ? lerp(BASE, VIOLET, t / 0.55) : lerp(VIOLET, WHITE, (t - 0.55) / 0.45);
}

/** Luminance to themed-icon alpha: a soft shoulder rather than a hard cut. */
function alphaFor(v) {
  const t = Math.min(1, Math.max(0, (v - 42) / 118));
  return Math.round(255 * (t * t * (3 - 2 * t)));
}

/** Greyscale pixels of the crop at `size`, upscaled with lanczos and normalised. */
async function luma(size) {
  const { data } = await sharp(SRC)
    .extract(CROP)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/** The duotone portrait, full bleed, opaque. */
async function portrait(size) {
  const grey = await luma(size);
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < grey.length; i++) {
    const [r, g, b] = ramp(grey[i]);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return sharp(rgb, { raw: { width: size, height: size, channels: 3 } });
}

/** White silhouette on transparent, for the themed-icon monochrome layer. */
async function monochrome(size) {
  const grey = await luma(size);
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < grey.length; i++) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = alphaFor(grey[i]);
  }
  return sharp(rgba, { raw: { width: size, height: size, channels: 4 } });
}

/** Centre `inner` on a transparent canvas of `size`, sized to the safe zone. */
async function onSafeCanvas(inner, size) {
  const art = Math.round(size * SAFE);
  const buf = await (await inner(art)).png().toBuffer();
  const pad = Math.round((size - art) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: buf, top: pad, left: pad }]);
}

/** Circular crop, for the legacy round launcher icon. */
async function round(size) {
  const buf = await (await portrait(size)).png().toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]);
}

async function write(pipeline, relPath, format) {
  const dest = join(OUT, relPath);
  await mkdir(dirname(dest), { recursive: true });
  const out = format === 'webp'
    ? pipeline.webp({ quality: 92, alphaQuality: 100 })
    : pipeline.png({ compressionLevel: 9 });
  await writeFile(dest, await out.toBuffer());
  console.log('  ' + relPath);
}

/**
 * dp sizes per density bucket: legacy launcher is 48dp, adaptive layers 108dp,
 * and the splash mark is 160dp centred by drawable/splashscreen.xml.
 */
const DENSITIES = [
  ['mdpi', 48, 108, 160],
  ['hdpi', 72, 162, 240],
  ['xhdpi', 96, 216, 320],
  ['xxhdpi', 144, 324, 480],
  ['xxxhdpi', 192, 432, 640],
];

const RES = 'android/app/src/main/res';

console.log('source', SRC);
console.log('out   ', OUT, '\n');

console.log('expo assets');
await write(await portrait(1024), 'assets/icon.png');
await write(await onSafeCanvas(portrait, 432), 'assets/android-icon-foreground.png');
await write(await onSafeCanvas(monochrome, 432), 'assets/android-icon-monochrome.png');
await write(await round(1024), 'assets/splash-icon.png');
await write(await portrait(48), 'assets/favicon.png');

console.log('\nandroid mipmaps');
for (const [density, legacy, adaptive] of DENSITIES) {
  const dir = `${RES}/mipmap-${density}`;
  await write(await portrait(legacy), `${dir}/ic_launcher.webp`, 'webp');
  await write(await round(legacy), `${dir}/ic_launcher_round.webp`, 'webp');
  await write(await onSafeCanvas(portrait, adaptive), `${dir}/ic_launcher_foreground.webp`, 'webp');
  await write(await onSafeCanvas(monochrome, adaptive), `${dir}/ic_launcher_monochrome.webp`, 'webp');
}

console.log('\nandroid splash');
for (const [density, , , splash] of DENSITIES) {
  await write(await round(splash), `${RES}/drawable-${density}/splashscreen_logo.png`);
}

console.log('\ndone');
