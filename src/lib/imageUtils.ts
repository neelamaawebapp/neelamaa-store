/**
 * Automatically adjusts an image file to a targeted aspect ratio.
 * Crops the image to center, resizes it to cap max width at 1200px (to keep loads optimized),
 * and compresses it to an 85% quality JPEG.
 */
export function autoAdjustImage(file: File, targetRatio: number): Promise<File> {
  return new Promise((resolve) => {
    // If the file is not an image, bypass processing
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          const imgWidth = img.naturalWidth;
          const imgHeight = img.naturalHeight;
          const currentRatio = imgWidth / imgHeight;

          let cropX = 0;
          let cropY = 0;
          let cropWidth = imgWidth;
          let cropHeight = imgHeight;

          if (currentRatio > targetRatio) {
            // Image is wider than target aspect ratio: crop sides
            cropWidth = imgHeight * targetRatio;
            cropX = (imgWidth - cropWidth) / 2;
          } else {
            // Image is taller than target aspect ratio: crop top & bottom
            cropHeight = imgWidth / targetRatio;
            cropY = (imgHeight - cropHeight) / 2;
          }

          // Capping size to optimized web banner width (1200px)
          const targetWidth = Math.min(1200, cropWidth);
          const targetHeight = targetWidth / targetRatio;

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Draw cropped and scaled image onto canvas
          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            targetWidth,
            targetHeight
          );

          // Export as compressed 85% JPEG to reduce bandwidth footprint
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Keep original file name, just swap extension to .jpg
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const adjustedFile = new File([blob], `${baseName}_adjusted.jpg`, {
                  type: "image/jpeg",
                });
                resolve(adjustedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.85
          );
        } catch (err) {
          console.error("Failed to automatically adjust image canvas:", err);
          resolve(file); // Fallback to original
        }
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
