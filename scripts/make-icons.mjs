import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('public/icon.svg');
const targets = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
];
for (const [file, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}px)`);
}
