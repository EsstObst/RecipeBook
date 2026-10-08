import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepareImage } from './prepare-image.mjs';

let dir;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'prepare-image-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

async function makePng(width, height) {
  const path = join(dir, `in-${width}x${height}.png`);
  await sharp({ create: { width, height, channels: 3, background: '#c84' } }).png().toFile(path);
  return path;
}

describe('prepareImage', () => {
  it('shrinks landscape images to 2000 px width as JPEG', async () => {
    const out = join(dir, 'landscape.jpg');
    await prepareImage(await makePng(3000, 1500), out);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 2000, 1000]);
  });

  it('shrinks portrait images to 2000 px height', async () => {
    const out = join(dir, 'portrait.jpg');
    await prepareImage(await makePng(1000, 4000), out);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([500, 2000]);
  });

  it('does not enlarge small images', async () => {
    const out = join(dir, 'small.jpg');
    await prepareImage(await makePng(800, 600), out);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 800, 600]);
  });
});
