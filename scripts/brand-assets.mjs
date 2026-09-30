import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("public/brand", { recursive: true });
const icon = await readFile("src/app/icon.svg");
for (const [name, size] of [
  ["icon-32", 32],
  ["apple-touch-icon", 180],
  ["icon-192", 192],
  ["icon-512", 512],
]) {
  await writeFile(
    `public/brand/${name}.png`,
    await sharp(icon).resize(size, size).png().toBuffer(),
  );
}
console.log("Server-hosted brand icons generated.");
