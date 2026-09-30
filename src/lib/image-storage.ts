import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { HttpError } from "./auth";
export const maxImageBytes = 5 * 1024 * 1024;
export async function storeImage(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > maxImageBytes)
    throw new HttpError(400, "Choose an image under 5 MB.");
  const formats: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
  };
  if (!Object.hasOwn(formats, mime))
    throw new HttpError(400, "Use a PNG, JPG, or WebP image.");
  let normalized;
  try {
    const image = sharp(bytes, {
      limitInputPixels: 25_000_000,
      failOn: "error",
      animated: false,
    });
    const metadata = await image.metadata();
    if (metadata.format !== formats[mime] || (metadata.pages || 1) > 1)
      throw new Error("Unsupported image");
    // Decode the entire file, rotate correctly, bound dimensions, strip metadata.
    normalized = await image
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new HttpError(
      400,
      "This image could not be read. Use a valid PNG, JPG, or WebP under 25 megapixels.",
    );
  }
  const name = `${randomUUID()}.webp`;
  let url = `/api/uploads/${name}`;
  if (process.env.S3_BUCKET || process.env.S3_PUBLIC_URL) {
    if (
      !process.env.S3_BUCKET ||
      !process.env.S3_PUBLIC_URL ||
      !process.env.S3_ACCESS_KEY_ID ||
      !process.env.S3_SECRET_ACCESS_KEY
    )
      throw new Error("Image storage is not fully configured");
    const s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `images/${name}`,
        Body: normalized.data,
        ContentType: "image/webp",
        CacheControl: "public,max-age=31536000,immutable",
      }),
    );
    url = `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/images/${name}`;
  } else {
    const dir = resolve(
      /* turbopackIgnore: true */ process.env.UPLOAD_DIR || "data/uploads",
    );
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, name), normalized.data, { flag: "wx" });
  }
  return { url, width: normalized.info.width, height: normalized.info.height };
}
