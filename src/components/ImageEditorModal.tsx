"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, RotateCw, RotateCcw, RefreshCw, Check, AlertTriangle, Maximize2, Minimize2, Image as ImageIcon } from "lucide-react";

interface ImageEditorModalProps {
  imageUrl: string;
  onSave: (editedFile: File, editedDataUrl: string) => void;
  onClose: () => void;
  aspectRatio?: number | "free";
}

export default function ImageEditorModal({
  imageUrl,
  onSave,
  onClose,
  aspectRatio: initialAspectRatio = "free",
}: ImageEditorModalProps) {
  const [aspectRatio, setAspectRatio] = useState<number | "free">(initialAspectRatio);
  const [crop, setCrop] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Stretching / Scale
  const [scaleX, setScaleX] = useState(1); // Width stretching
  const [scaleY, setScaleY] = useState(1); // Height stretching

  // Filters
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const [isAnimated, setIsAnimated] = useState(false);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Check if image is animated (APNG / GIF)
  useEffect(() => {
    if (imageUrl) {
      const lower = imageUrl.toLowerCase();
      if (lower.includes(".apng") || lower.includes(".gif")) {
        setIsAnimated(true);
      }
    }
  }, [imageUrl]);

  const resetCropToRatio = (ratio: number | "free") => {
    const container = containerRef.current;
    const img = imageRef.current;
    if (!container || !img) {
      setCrop({ x: 10, y: 10, width: 80, height: 80 });
      return;
    }

    // Get the displayed dimensions of the image inside the container
    const imgWidth = img.clientWidth;
    const imgHeight = img.clientHeight;

    if (ratio === "free") {
      setCrop({ x: 10, y: 10, width: 80, height: 80 });
    } else {
      const imgRatio = imgWidth / imgHeight;
      let w = 80;
      let h = (w * imgRatio) / ratio;
      
      if (h > 80) {
        h = 80;
        w = (h * ratio) / imgRatio;
      }

      setCrop({
        x: (100 - w) / 2,
        y: (100 - h) / 2,
        width: w,
        height: h,
      });
    }
  };

  // Set initial crop once image is loaded
  const handleImageLoad = () => {
    setLoading(false);
    // Add small delay to ensure layout clientWidth/Height are correct
    setTimeout(() => {
      resetCropToRatio(aspectRatio);
    }, 100);
  };

  // Re-adjust crop when aspect ratio selection changes
  useEffect(() => {
    if (!loading) {
      resetCropToRatio(aspectRatio);
    }
  }, [aspectRatio, loading]);

  // Handle Dragging / Resizing crop box
  const handlePointerDown = (e: React.PointerEvent, corner: string) => {
    e.preventDefault();
    const container = containerRef.current;
    const img = imageRef.current;
    if (!container || !img) return;

    // Get bounding box of the displayed image (not the full container container)
    const imgRect = img.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...crop };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      // Delta in terms of percentage of the image width / height
      const deltaX = ((moveEvent.clientX - startX) / imgRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / imgRect.height) * 100;

      let newCrop = { ...startCrop };

      if (corner === "move") {
        newCrop.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaX));
        newCrop.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaY));
      } else {
        if (corner.includes("l")) {
          newCrop.x = Math.max(0, Math.min(startCrop.x + startCrop.width - 5, startCrop.x + deltaX));
          newCrop.width = startCrop.x + startCrop.width - newCrop.x;
        } else if (corner.includes("r")) {
          newCrop.width = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaX));
        }

        if (corner.includes("t")) {
          newCrop.y = Math.max(0, Math.min(startCrop.y + startCrop.height - 5, startCrop.y + deltaY));
          newCrop.height = startCrop.y + startCrop.height - newCrop.y;
        } else if (corner.includes("b")) {
          newCrop.height = Math.max(5, Math.min(100 - startCrop.y, startCrop.height + deltaY));
        }

        // Apply aspect ratio constraints if selected
        if (aspectRatio && aspectRatio !== "free") {
          const imgRatio = imgRect.width / imgRect.height;
          
          if (corner === "tr" || corner === "br" || corner === "tl" || corner === "bl") {
            if (corner.includes("r")) {
              newCrop.height = (newCrop.width * imgRatio) / aspectRatio;
              if (corner.includes("t")) {
                newCrop.y = startCrop.y + startCrop.height - newCrop.height;
              }
            } else {
              newCrop.width = (newCrop.height * aspectRatio) / imgRatio;
              if (corner.includes("t")) {
                newCrop.x = startCrop.x + startCrop.width - newCrop.width;
              }
            }

            // Ensure crop box stays inside bounds
            if (newCrop.x < 0) {
              newCrop.x = 0;
              newCrop.width = startCrop.x + startCrop.width;
              newCrop.height = (newCrop.width * imgRatio) / aspectRatio;
            }
            if (newCrop.y < 0) {
              newCrop.y = 0;
              newCrop.height = startCrop.y + startCrop.height;
              newCrop.width = (newCrop.height * aspectRatio) / imgRatio;
            }
            if (newCrop.x + newCrop.width > 100) {
              newCrop.width = 100 - newCrop.x;
              newCrop.height = (newCrop.width * imgRatio) / aspectRatio;
            }
            if (newCrop.y + newCrop.height > 100) {
              newCrop.height = 100 - newCrop.y;
              newCrop.width = (newCrop.height * aspectRatio) / imgRatio;
            }
          }
        }
      }

      setCrop(newCrop);
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const rotate = (dir: "cw" | "ccw") => {
    setRotation((prev) => {
      let next = dir === "cw" ? prev + 90 : prev - 90;
      if (next >= 360) next = 0;
      if (next < 0) next = 270;
      return next;
    });
  };

  const resetAll = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setScaleX(1);
    setScaleY(1);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setAspectRatio(initialAspectRatio);
    resetCropToRatio(initialAspectRatio);
  };

  const handleSave = async () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;

        // Convert percentage crop back to actual source image pixels
        const cropX = (crop.x / 100) * imgWidth;
        const cropY = (crop.y / 100) * imgHeight;
        const cropW = (crop.width / 100) * imgWidth;
        const cropH = (crop.height / 100) * imgHeight;

        // Compute output dimension including stretching (Scale X, Scale Y)
        const outputW = cropW * scaleX;
        const outputH = cropH * scaleY;

        // Check if rotated orthogonal (90 / 270 deg)
        const isRotatedOrtho = rotation === 90 || rotation === 270;
        const canvasW = isRotatedOrtho ? outputH : outputW;
        const canvasH = isRotatedOrtho ? outputW : outputH;

        canvas.width = canvasW;
        canvas.height = canvasH;

        // Apply filters (brightness, contrast, saturation)
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

        // Draw image onto canvas applying transformations
        ctx.save();
        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropW,
          cropH,
          -outputW / 2,
          -outputH / 2,
          outputW,
          outputH
        );
        ctx.restore();

        // Convert canvas to blob/file
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `edited_image_${Date.now()}.png`, {
                type: "image/png",
              });
              const dataUrl = URL.createObjectURL(blob);
              onSave(file, dataUrl);
            }
          },
          "image/png",
          0.95
        );
      } catch (err) {
        console.error("Canvas export error", err);
        alert("Could not save edited image. If it is an external image, CORS constraints might have blocked it.");
      }
    };
    img.src = imageUrl;
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl animate-fade-in text-slate-100">
        
        {/* Left / Top: Interactive Image Viewport */}
        <div className="flex-1 bg-slate-950 flex flex-col justify-center items-center p-4 relative min-h-[300px] md:min-h-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {isAnimated && (
            <div className="absolute top-4 left-4 right-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2.5 rounded-xl flex items-center gap-2 text-xs z-15">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>
                <strong>Warning:</strong> This image appears to be animated (APNG/GIF). Editing will flatten it into a static image.
              </span>
            </div>
          )}

          <div
            ref={containerRef}
            className="relative select-none max-w-full max-h-[50vh] md:max-h-[70vh] flex items-center justify-center"
            style={{
              transform: `scale(${scaleX}, ${scaleY})`,
              transition: "transform 0.15s ease-out",
            }}
          >
            {/* The image itself */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Editor Source"
              onLoad={handleImageLoad}
              className="max-w-full max-h-[50vh] md:max-h-[70vh] object-contain select-none pointer-events-none"
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
                transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                transition: "filter 0.1s ease-out, transform 0.1s ease-out",
              }}
            />

            {/* Crop Draggable Grid */}
            {!loading && (
              <div
                className="absolute border border-pink-500 bg-pink-500/5 cursor-move"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                }}
                onPointerDown={(e) => handlePointerDown(e, "move")}
              >
                {/* Visual crop guidelines (rule of thirds) */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-r border-b border-pink-500/20"></div>
                  <div className="border-r border-b border-pink-500/20"></div>
                  <div className="border-b border-pink-500/20"></div>
                  <div className="border-r border-b border-pink-500/20"></div>
                  <div className="border-r border-b border-pink-500/20"></div>
                  <div className="border-b border-pink-500/20"></div>
                  <div className="border-r border-pink-500/20"></div>
                  <div className="border-r border-pink-500/20"></div>
                  <div></div>
                </div>

                {/* Resizing handles (corners) */}
                <div
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-pink-500 border border-white rounded-full cursor-nwse-resize z-20"
                  onPointerDown={(e) => handlePointerDown(e, "tl")}
                />
                <div
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-pink-500 border border-white rounded-full cursor-nesw-resize z-20"
                  onPointerDown={(e) => handlePointerDown(e, "tr")}
                />
                <div
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-pink-500 border border-white rounded-full cursor-nesw-resize z-20"
                  onPointerDown={(e) => handlePointerDown(e, "bl")}
                />
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-pink-500 border border-white rounded-full cursor-nwse-resize z-20"
                  onPointerDown={(e) => handlePointerDown(e, "br")}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right / Bottom: Control Panel */}
        <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col max-h-[40vh] md:max-h-full overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
            <h3 className="font-extrabold text-sm tracking-wider uppercase flex items-center gap-1.5">
              <ImageIcon size={16} className="text-pink-500" /> Photo Lab
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-5 flex-1">
            {/* Aspect Ratio Presets */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Crop Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Free", value: "free" },
                  { label: "1:1 Square", value: 1 },
                  { label: "3:4 Item", value: 3 / 4 },
                  { label: "16:9 Slide", value: 16 / 9 },
                  { label: "21:9 Banner", value: 21 / 9 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setAspectRatio(item.value as any)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate cursor-pointer ${
                      aspectRatio === item.value
                        ? "bg-gradient-to-r from-pink-500 to-orange-500 border-transparent text-white"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stretching / Independent Scale */}
            <div className="space-y-3 border-t border-slate-800/60 pt-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stretching / Resizing</label>
              
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Stretch Width (X): {scaleX.toFixed(2)}x</span>
                  <button onClick={() => setScaleX(1)} className="text-pink-500 hover:underline">Reset</button>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={scaleX}
                  onChange={(e) => setScaleX(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-950 rounded-lg appearance-none h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Stretch Height (Y): {scaleY.toFixed(2)}x</span>
                  <button onClick={() => setScaleY(1)} className="text-pink-500 hover:underline">Reset</button>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={scaleY}
                  onChange={(e) => setScaleY(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-950 rounded-lg appearance-none h-1.5"
                />
              </div>
            </div>

            {/* Rotation & Flip */}
            <div className="space-y-3 border-t border-slate-800/60 pt-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orientation</label>
              <div className="flex gap-2">
                <button
                  onClick={() => rotate("ccw")}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-350 cursor-pointer"
                >
                  <RotateCcw size={14} /> -90°
                </button>
                <button
                  onClick={() => rotate("cw")}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-350 cursor-pointer"
                >
                  <RotateCw size={14} /> +90°
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlipH(!flipH)}
                  className={`flex-1 border rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                    flipH
                      ? "bg-pink-500/10 border-pink-500 text-pink-400"
                      : "bg-slate-950 border-slate-800 text-slate-350 hover:bg-slate-900"
                  }`}
                >
                  Flip H
                </button>
                <button
                  onClick={() => setFlipV(!flipV)}
                  className={`flex-1 border rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
                    flipV
                      ? "bg-pink-500/10 border-pink-500 text-pink-400"
                      : "bg-slate-950 border-slate-800 text-slate-350 hover:bg-slate-900"
                  }`}
                >
                  Flip V
                </button>
              </div>
            </div>

            {/* Adjustments */}
            <div className="space-y-3 border-t border-slate-800/60 pt-4 pb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Colors & Filters</label>
              
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Brightness: {brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-950 rounded-lg appearance-none h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Contrast: {contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-950 rounded-lg appearance-none h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Saturation: {saturation}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={saturation}
                  onChange={(e) => setSaturation(parseInt(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-950 rounded-lg appearance-none h-1.5"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex gap-2 sticky bottom-0">
            <button
              onClick={resetAll}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs font-extrabold py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} /> Reset
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-90 text-xs font-extrabold py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer text-white"
            >
              <Check size={14} /> Save
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
