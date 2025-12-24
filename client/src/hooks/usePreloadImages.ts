import { useEffect, useState } from 'react';

/**
 * Hook to preload images in parallel
 * Useful for animation sequences to ensure smooth playback
 */
export const usePreloadImages = (imageUrls: (string | undefined)[]): boolean => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) {
      setIsLoaded(true);
      return;
    }

    const validUrls = imageUrls.filter(Boolean) as string[];
    if (validUrls.length === 0) {
      setIsLoaded(true);
      return;
    }

    let loadedCount = 0;
    const totalImages = validUrls.length;

    validUrls.forEach(url => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount >= totalImages) {
          setIsLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= totalImages) {
          setIsLoaded(true);
        }
      };
      img.src = url;
    });
  }, [imageUrls]);

  return isLoaded;
};

/**
 * Preload archetype images for animation sequences
 * Call this on page mount to cache images before animations start
 */
export const preloadArchetypeImages = (images: Record<string, string | undefined>): Promise<void> => {
  const urls = Object.values(images).filter(Boolean) as string[];
  
  return Promise.all(
    urls.map(url => 
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve on error too
        img.src = url;
      })
    )
  ).then(() => undefined);
};
