import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Save to public/uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    
    // Ensure the directory exists
    await mkdir(uploadsDir, { recursive: true });
    
    // Clean filename of special characters but preserve extension
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}_${cleanName}`;
    const filePath = path.join(uploadsDir, filename);
    
    await writeFile(filePath, buffer);
    
    // Return relative URL that Next.js serves statically
    const fileUrl = `/uploads/${filename}`;
    
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error("Error saving uploaded video:", error);
    return NextResponse.json({ error: error.message || "Failed to upload video" }, { status: 500 });
  }
}
