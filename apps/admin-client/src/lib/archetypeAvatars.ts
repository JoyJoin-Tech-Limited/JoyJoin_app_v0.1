// 12-Archetype Animal Social Vibe System
// Avatar image mapping system with high-res transparent illustrations
import corgiImg from '@assets/corgi_transparent_1_1767673999923.png';
import foxImg from '@assets/fox_transparent_2_1767673999921.png';
import bearImg from '@assets/koala_transparent_3_1767673999919.png';
import spiderImg from '@assets/spider_transparent_4_1767673999924.png';
import dolphinImg from '@assets/hamster_praise_transparent_5_1767673999925.png';
import chickenImg from '@assets/rooster_transparent_6_1767673999921.png';
import calmDolphinImg from '@assets/dolphin_calm_transparent_7_1767673999925.png';
import owlImg from '@assets/owl_transparent_8_1767673999922.png';
import turtleImg from '@assets/turtle_transparent_9_1767673999923.png';
import catImg from '@assets/cat_transparent_10_1767673999924.png';
import elephantImg from '@assets/elephant_transparent_11_1767673999922.png';
import octopusImg from '@assets/octopus_transparent_12_1767673999924.png';

export const archetypeAvatars: Record<string, string> = {
  'corgi': corgiImg,
  'rooster': chickenImg,
  'hamster_praise': dolphinImg,
  'fox': foxImg,
  'dolphin_calm': calmDolphinImg,
  'spider': spiderImg,
  'koala': bearImg,
  'octopus': octopusImg,
  'owl': owlImg,
  'elephant': elephantImg,
  'turtle': turtleImg,
  'cat': catImg,
};

// Gradient backgrounds for each archetype (energy-based color mapping)
export const archetypeGradients: Record<string, string> = {
  'corgi': 'from-yellow-500 via-orange-500 to-red-500',      // High energy
  'rooster': 'from-amber-500 via-yellow-500 to-orange-500',       // High energy
  'hamster_praise': 'from-cyan-500 via-blue-500 to-indigo-500',         // High energy
  'fox': 'from-orange-500 via-red-500 to-pink-500',          // High energy
  'dolphin_calm': 'from-blue-500 via-indigo-500 to-purple-500',      // Medium energy
  'spider': 'from-purple-500 via-pink-500 to-fuchsia-500',      // Medium energy
  'koala': 'from-rose-500 via-pink-500 to-red-500',            // Medium energy
  'octopus': 'from-violet-500 via-purple-500 to-indigo-500',    // Medium energy
  'owl': 'from-slate-500 via-gray-500 to-zinc-500',        // Low energy
  'elephant': 'from-gray-500 via-slate-500 to-stone-500',        // Low energy
  'turtle': 'from-green-500 via-emerald-500 to-teal-500',       // Very low energy
  'cat': 'from-indigo-500 via-purple-500 to-violet-500',     // Very low energy
};

// Primary avatar mapping used by UI components.
// For backward compatibility, archetypeEmojis now points to the image URLs
// instead of emoji characters, so existing code that uses archetypeEmojis
// will automatically start rendering the imported images.
export const archetypeEmojis: Record<string, string> = archetypeAvatars;
