// Perceptual hash: resize 32×32 grayscale, mean-threshold 8×8 block → 64-bit integer
import sharp from 'sharp';

export async function computePhash(imageBuffer: Buffer): Promise<bigint> {
  const { data } = await sharp(imageBuffer)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  let sum = 0;
  for (let i = 0; i < pixels.length; i++) sum += pixels[i];
  const mean = sum / pixels.length;

  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (pixels[i] > mean) hash |= 1n << BigInt(63 - i);
  }

  return hash;
}

export function phashToHex(phash: bigint): string {
  return phash.toString(16).padStart(16, '0');
}
