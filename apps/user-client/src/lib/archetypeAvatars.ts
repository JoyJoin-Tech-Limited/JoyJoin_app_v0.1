// 12-Archetype Animal Social Vibe System
// Avatar image mapping system with high-res transparent illustrations
import corgiImg from '@assets/开心柯基_transparent_1.png';
import foxImg from '@assets/机智狐_transparent_2.png';
import bearImg from '@assets/暖心熊_transparent_3.png';
import spiderImg from '@assets/织网蛛_transparent_4.png';
import dolphinImg from '@assets/夸夸豚_transparent_5.png';
import chickenImg from '@assets/太阳鸡_transparent_6.png';
import calmDolphinImg from '@assets/淡定海豚_transparent_7.png';
import owlImg from '@assets/沉思猫头鹰_transparent_8.png';
import turtleImg from '@assets/稳如龟_transparent_9.png';
import catImg from '@assets/隐身猫_transparent_10.png';
import elephantImg from '@assets/定心大象_transparent_11.png';
import octopusImg from '@assets/灵感章鱼_transparent_12.png';

export const archetypeAvatars: Record<string, string> = {
  '开心柯基': corgiImg,
  '太阳鸡': chickenImg,
  '夸夸豚': dolphinImg,
  '机智狐': foxImg,
  '淡定海豚': calmDolphinImg,
  '织网蛛': spiderImg,
  '暖心熊': bearImg,
  '灵感章鱼': octopusImg,
  '沉思猫头鹰': owlImg,
  '定心大象': elephantImg,
  '稳如龟': turtleImg,
  '隐身猫': catImg,
};

// Light background colors for avatar circles (used in chat module)
export const archetypeBgColors: Record<string, string> = {
  '开心柯基': 'bg-orange-100',
  '太阳鸡': 'bg-amber-100',
  '夸夸豚': 'bg-cyan-100',
  '机智狐': 'bg-orange-100',
  '淡定海豚': 'bg-blue-100',
  '织网蛛': 'bg-purple-100',
  '暖心熊': 'bg-rose-100',
  '灵感章鱼': 'bg-violet-100',
  '沉思猫头鹰': 'bg-slate-100',
  '定心大象': 'bg-gray-100',
  '稳如龟': 'bg-emerald-100',
  '隐身猫': 'bg-indigo-100',
};

// Gradient backgrounds for each archetype (energy-based color mapping)
export const archetypeGradients: Record<string, string> = {
  '开心柯基': 'from-yellow-500 via-orange-500 to-red-500',      // High energy
  '太阳鸡': 'from-amber-500 via-yellow-500 to-orange-500',       // High energy
  '夸夸豚': 'from-cyan-500 via-blue-500 to-indigo-500',         // High energy
  '机智狐': 'from-orange-500 via-red-500 to-pink-500',          // High energy
  '淡定海豚': 'from-blue-500 via-indigo-500 to-purple-500',      // Medium energy
  '织网蛛': 'from-purple-500 via-pink-500 to-fuchsia-500',      // Medium energy
  '暖心熊': 'from-rose-500 via-pink-500 to-red-500',            // Medium energy
  '灵感章鱼': 'from-violet-500 via-purple-500 to-indigo-500',    // Medium energy
  '沉思猫头鹰': 'from-slate-500 via-gray-500 to-zinc-500',        // Low energy
  '定心大象': 'from-gray-500 via-slate-500 to-stone-500',        // Low energy
  '稳如龟': 'from-green-500 via-emerald-500 to-teal-500',       // Very low energy
  '隐身猫': 'from-indigo-500 via-purple-500 to-violet-500',     // Very low energy
};

// Primary avatar mapping used by UI components.
// For backward compatibility, archetypeEmojis now points to the image URLs
// instead of emoji characters, so existing code that uses archetypeEmojis
// will automatically start rendering the imported images.
export const archetypeEmojis: Record<string, string> = archetypeAvatars;
