import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { saveLocal } from "@/lib/local-storage";

const REGION = process.env.AWS_REGION || "ap-south-1";
const BUCKET_NAME = process.env.AWS_S3_BUCKET || "your-bucket-name";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    console.log("AWS Configuration:", {
      region: REGION,
      bucket: BUCKET_NAME,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only images are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large. Max 10MB allowed." },
        { status: 400 }
      );
    }

    // Unique filename
    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileExtension = ["jpg", "jpeg", "png", "gif", "webp"].includes(rawExt) ? rawExt : "jpg";
    const id = uuidv4();
    const fileName = `images/chat/${id}.${fileExtension}`;

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3, unless local storage is forced; on S3 failure fall back to local disk.
    if (process.env.STORAGE_MODE !== "local") {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
          })
        );
        const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
        return NextResponse.json({ success: true, url: publicUrl, storage: "s3" });
      } catch (s3Error: any) {
        console.warn("S3 upload failed, falling back to local storage:", s3Error?.message);
      }
    }

    const localName = `${id}.${fileExtension}`;
    await saveLocal(localName, buffer);
    const origin = process.env.PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.json({ success: true, url: `${origin}/api/files/${localName}`, storage: "local" });
  } catch (error: any) {
    console.error("S3 Upload Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "S3 upload failed",
      },
      { status: 500 }
    );
  }
}
