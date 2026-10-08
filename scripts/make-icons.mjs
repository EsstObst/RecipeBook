import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const icon = await readFile('public/icon.svg');
const maskable = await readFile('public/icon-maskable.svg');
const targets = [
  [icon, 'public/icon-192.png', 192],
  [icon, 'public/icon-512.png', 512],
  [maskable, 'public/icon-maskable-512.png', 512],
  [maskable, 'public/apple-touch-icon.png', 180],
];
for (const [svg, file, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}px)`);
}
