"use client";

import Image from "next/image";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  className = "",
  fill = false,
  width,
  height,
  priority = false,
}: OptimizedImageProps) {
  if (!src) return null;

  // Next.js Image optimization works for hostnames configured in next.config.mjs
  const isOptimizable =
    src.startsWith("https://i.ibb.co") ||
    src.startsWith("https://images.unsplash.com");

  if (isOptimizable) {
    return (
      <Image
        src={src}
        alt={alt}
        className={className}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        priority={priority}
        sizes={fill ? "(max-width: 768px) 100vw, 400px" : undefined}
      />
    );
  }

  // Fallback to standard optimized lazy-loaded HTML image to avoid Remote Pattern runtime crashes
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
