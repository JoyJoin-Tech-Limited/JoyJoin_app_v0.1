/**
 * Landing Image Gallery Component
 * 
 * Displays a 2x2 grid of lifestyle images with subtle rotation effects.
 * Images are loaded from the landingImages config file.
 * Supports lazy loading and gradient fallbacks.
 * 
 * Usage:
 * ```tsx
 * <LandingImageGallery />
 * ```
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { landingImages } from "@/config/landingImages";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function LandingImageGallery() {
  const prefersReducedMotion = useReducedMotion();
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (id: string) => {
    setLoadedImages(prev => new Set(prev).add(id));
  };

  const handleImageError = (id: string) => {
    // Image failed to load - fallback gradient will remain visible
    console.warn(`Failed to load landing image: ${id}`);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-8 safe-area-top">
      <div className="grid grid-cols-2 gap-3">
        {landingImages.map((image, index) => (
          <motion.div
            key={image.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              delay: index * 0.1,
              duration: 0.5,
              ease: "easeOut"
            }}
            className="relative aspect-square"
            style={{
              transform: prefersReducedMotion 
                ? 'none' 
                : `rotate(${image.rotation || 0}deg)`,
            }}
          >
            {/* Gradient fallback - shown until image loads or on error */}
            <div 
              className="absolute inset-0 rounded-2xl overflow-hidden shadow-md"
              style={{
                background: `linear-gradient(135deg, 
                  hsl(${220 + index * 40}, 70%, ${60 + index * 5}%), 
                  hsl(${280 + index * 30}, 65%, ${50 + index * 5}%))`,
              }}
            >
              {/* Image overlay */}
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                onLoad={() => handleImageLoad(image.id)}
                onError={() => handleImageError(image.id)}
                className={`
                  w-full h-full object-cover transition-opacity duration-500
                  ${loadedImages.has(image.id) ? 'opacity-100' : 'opacity-0'}
                `}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
