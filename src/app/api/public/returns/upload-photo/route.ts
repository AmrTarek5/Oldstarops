import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "return-photos";
const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

async function ensureBucket(db: ReturnType<typeof supabaseAdmin>) {
  const { data: buckets } = await db.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE_BYTES });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
  }

  const db = supabaseAdmin();
  try {
    await ensureBucket(db);
  } catch {
    // Bucket likely already exists under a race - continue to upload.
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = db.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicUrl.publicUrl });
}
