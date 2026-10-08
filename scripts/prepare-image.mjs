import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

export const MAX_EDGE = 2000;

export async function prepareImage(inputPath, outputPath) {
  let input = await readFile(inputPath);
  if (['.heic', '.heif'].includes(extname(inputPath).toLowerCase())) {
    input = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 1 }));
  }
  return sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(outputPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Aufruf: npm run image -- <eingabe> <ausgabe.jpg>');
    process.exit(1);
  }
  const info = await prepareImage(input, output);
  console.log(`${output}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}
