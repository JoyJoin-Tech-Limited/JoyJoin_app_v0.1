// 12-Archetype Animal Social Vibe System
// Avatar image mapping system with high-res transparent illustrations
import corgiImg from "@/assets/corgi_transparent_1.png";
import foxImg from "@/assets/fox_transparent_2.png";
import bearImg from "@/assets/koala_transparent_3.png";
import spiderImg from "@/assets/spider_transparent_4.png";
import dolphinImg from "@/assets/hamster_praise_transparent_5.png";
import chickenImg from "@/assets/rooster_transparent_6.png";
import calmDolphinImg from "@/assets/dolphin_calm_transparent_7.png";
import owlImg from "@/assets/owl_transparent_8.png";
import turtleImg from "@/assets/turtle_transparent_9.png";
import catImg from "@/assets/cat_transparent_10.png";
import elephantImg from "@/assets/elephant_transparent_11.png";
import octopusImg from "@/assets/octopus_transparent_12.png";

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

// Light background colors for avatar circles (used in chat module)
export const archetypeBgColors: Record<string, string> = {
  'corgi': 'bg-orange-100',
  'rooster': 'bg-amber-100',
  'hamster_praise': 'bg-cyan-100',
  'fox': 'bg-orange-100',
  'dolphin_calm': 'bg-blue-100',
  'spider': 'bg-purple-100',
  'koala': 'bg-rose-100',
  'octopus': 'bg-violet-100',
  'owl': 'bg-slate-100',
  'elephant': 'bg-gray-100',
  'turtle': 'bg-emerald-100',
  'cat': 'bg-indigo-100',
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
