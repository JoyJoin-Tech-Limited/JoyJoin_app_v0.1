/**
 * Landing Page Image Configuration
 * 
 * Update images here without touching component code.
 * Each image should be placed in /public/images/landing/
 * 
 * Image Requirements:
 * - Aspect ratio: 1:1 (square) or 3:4 (portrait) works best
 * - Minimum size: 600x600px for retina displays
 * - Format: .jpg for photos, .webp for better compression
 * - File size: < 500KB per image for fast loading
 */

export interface LandingImage {
  id: string;
  src: string;
  alt: string;
  rotation?: number; // degrees of tilt (-5 to 5 recommended)
}

export const landingImages: LandingImage[] = [
  {
    id: 'lifestyle-1',
    src: '/images/landing/lifestyle-1.svg',
    alt: '朋友聚会',
    rotation: -2,
  },
  {
    id: 'lifestyle-2',
    src: '/images/landing/lifestyle-2.svg',
    alt: '深度交流',
    rotation: 3,
  },
  {
    id: 'lifestyle-3',
    src: '/images/landing/lifestyle-3.svg',
    alt: '轻松娱乐',
    rotation: 2,
  },
  {
    id: 'lifestyle-4',
    src: '/images/landing/lifestyle-4.svg',
    alt: '美食分享',
    rotation: -3,
  },
];
