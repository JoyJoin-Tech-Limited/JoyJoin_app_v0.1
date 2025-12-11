/**
 * Resource Caching & Optimization
 * 网络优化策略：图片缓存和预加载
 */

export const ANIMATION_CACHE_VERSION = 'v1.0';

/**
 * Initialize resource cache for archetype images
 * Called on app startup to pre-warm cache
 */
export const initializeResourceCache = async () => {
  try {
    const cacheKey = `animation_images_${ANIMATION_CACHE_VERSION}`;
    
    // Check if we have cached version
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.debug('Animation resources loaded from cache');
      return;
    }

    // Preload and cache all archetype images
    const archetypeImages = [
      '开心柯基',
      '太阳鸡',
      '夸夸豚',
      '机智狐',
      '淡定海豚',
      '织网蛛',
      '暖心熊',
      '灵感章鱼',
      '沉思猫头鹰',
      '定心大象',
      '稳如龟',
      '隐身猫',
    ];

    const cachePromises = archetypeImages.map(archetype => 
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Image loaded and cached by browser
          resolve();
        };
        img.onerror = () => {
          // Continue on error
          resolve();
        };
        // Images will be cached automatically by browser
        img.src = `/api/archetype-image/${archetype}`;
      })
    );

    await Promise.all(cachePromises);
    
    // Mark cache as initialized
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      version: ANIMATION_CACHE_VERSION,
    }));

    console.debug('Animation resources cache initialized');
  } catch (error) {
    console.debug('Resource cache initialization failed (non-critical):', error);
  }
};

/**
 * Get optimal image quality based on connection speed
 */
export const getOptimalImageQuality = (): 'high' | 'medium' | 'low' => {
  if (!('connection' in navigator)) {
    return 'medium'; // Default for browsers without Network Information API
  }

  const connection = (navigator as any).connection;
  if (!connection) return 'medium';

  const effectiveType = connection.effectiveType;
  
  switch (effectiveType) {
    case '4g':
      return 'high';
    case '3g':
      return 'medium';
    case '2g':
    case 'slow-2g':
      return 'low';
    default:
      return 'medium';
  }
};

/**
 * Get cache headers for static resources
 */
export const getCacheHeaders = () => {
  return {
    'Cache-Control': 'public, max-age=86400, must-revalidate', // 24 hours
    'ETag': ANIMATION_CACHE_VERSION,
  };
};
