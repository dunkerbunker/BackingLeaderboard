import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name))
    return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(
      /* turbopackIgnore: true */
      resolve(process.env.UPLOAD_DIR || "data/uploads", name),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": name.endsWith("png")
          ? "image/png"
          : name.endsWith("jpg")
            ? "image/jpeg"
            : "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public,max-age=31536000,immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
