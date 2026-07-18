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
    
    // Clean filename of special characters but preserve extension
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}_${cleanName}`;

    // 1. Try local disk upload first (highly reliable for local development)
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, filename);
      await writeFile(filePath, buffer);
      
      const fileUrl = `/uploads/${filename}`;
      return NextResponse.json({ success: true, url: fileUrl });
    } catch (localWriteError: any) {
      console.warn("Failed to write to local filesystem (common in read-only hosting like Vercel). Attempting free cloud upload fallback...", localWriteError);
      
      // 2. Try Catbox.moe fallback (returns direct link to video file)
      try {
        const catboxFormData = new FormData();
        catboxFormData.append("reqtype", "fileupload");
        
        // Convert buffer back to Blob/File for FormData
        const fileBlob = new Blob([buffer], { type: file.type });
        catboxFormData.append("fileToUpload", fileBlob, file.name);
        
        const response = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: catboxFormData,
        });
        
        if (response.ok) {
          const fileUrl = await response.text();
          if (fileUrl && fileUrl.startsWith("https://")) {
            console.log("Successfully uploaded video to Catbox fallback:", fileUrl);
            return NextResponse.json({ success: true, url: fileUrl.trim() });
          }
        }
        throw new Error(`Catbox API returned status ${response.status}`);
      } catch (catboxError: any) {
        console.warn("Catbox upload failed, trying Pixeldrain fallback...", catboxError);
        
        // 3. Try Pixeldrain fallback
        try {
          const pixeldrainFormData = new FormData();
          const fileBlob = new Blob([buffer], { type: file.type });
          pixeldrainFormData.append("file", fileBlob, file.name);
          
          const response = await fetch("https://pixeldrain.com/api/file", {
            method: "POST",
            body: pixeldrainFormData,
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.id) {
              const fileUrl = `https://pixeldrain.com/api/file/${result.id}`;
              console.log("Successfully uploaded video to Pixeldrain fallback:", fileUrl);
              return NextResponse.json({ success: true, url: fileUrl });
            }
          }
          throw new Error(`Pixeldrain API returned status ${response.status}`);
        } catch (pixeldrainError: any) {
          console.error("All upload methods failed.");
          throw new Error(`All upload methods failed. Local error: ${localWriteError.message}. Catbox error: ${catboxError.message}. Pixeldrain error: ${pixeldrainError.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error("Error in upload-video API route:", error);
    return NextResponse.json({ error: error.message || "Failed to upload video" }, { status: 500 });
  }
}
