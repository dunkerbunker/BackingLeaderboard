import { NextRequest, NextResponse } from "next/server";
import { storeImage } from "@/lib/image-storage";
import { requireUser, HttpError } from "@/lib/auth";
import { checkOrigin, limit, ip } from "@/lib/security";
import { limitedBody } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const user = await requireUser();
    await limit(`upload:${user.sub}:${ip(req)}`, 15, 60);
    if (Number(req.headers.get("content-length")) > 6 * 1024 * 1024)
      throw new HttpError(413, "Images must be under 5 MB.");
    const raw = await limitedBody(req, 6 * 1024 * 1024);
    const form = await new Response(raw, {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
      throw new HttpError(400, "Choose an image under 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(await storeImage(bytes, file.type));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "Upload failed. Please try again.",
      },
      { status: error instanceof HttpError ? error.status : 500 },
    );
  }
}
