/**
 * Match Reveal Animation Configuration
 * 12个社交角色的专属出场动画配置
 */

import { archetypeAvatars, archetypeGradients } from './archetypeAvatars';

export type AnimationType = 
  | 'bounce_wiggle'    // 蹦跳摇摆 (柯基)
  | 'flap_radiate'     // 振翅光芒 (鸡)
  | 'leap_splash'      // 跃水溅花 (豚)
  | 'flash_wink'       // 闪现眨眼 (狐)
  | 'glide_ripple'     // 滑翔波纹 (海豚)
  | 'descend_weave'    // 垂丝织光 (蛛)
  | 'step_embrace'     // 缓步拥抱 (熊)
  | 'wave_lightbulb'   // 触手灯泡 (章鱼)
  | 'spread_feather'   // 展翅羽落 (猫头鹰)
  | 'march_trunk'      // 稳步鼻扬 (大象)
  | 'peek_steady'      // 探头坚定 (龟)
  | 'shadow_emerge'    // 阴影现身 (猫)

export interface ArchetypeAnimationConfig {
  animationType: AnimationType;
  duration: number; // seconds
  entryDirection: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'shadow';
  keyframes: {
    initial: Record<string, number | string>;
    animate: Record<string, number | string | number[]>;
    exit?: Record<string, number | string>;
  };
  particleEffect: {
    type: 'sparkle' | 'glow' | 'splash' | 'feather' | 'ripple' | 'thread' | 'heart' | 'star' | 'bubble' | 'dust';
    color: string;
    count: number;
  };
  soundMarker?: string; // For future audio implementation
}

export const archetypeAnimations: Record<string, ArchetypeAnimationConfig> = {
  '开心柯基': {
    animationType: 'bounce_wiggle',
    duration: 0.8,
    entryDirection: 'bottom',
    keyframes: {
      initial: { y: 100, opacity: 0, scale: 0.5, rotate: -10 },
      animate: { 
        y: 0, 
        opacity: 1, 
        scale: 1, 
        rotate: [0, -5, 5, -3, 3, 0] 
      },
    },
    particleEffect: {
      type: 'sparkle',
      color: '#F97316', // orange-500
      count: 12,
    },
    soundMarker: 'bounce_happy',
  },
  
  '太阳鸡': {
    animationType: 'flap_radiate',
    duration: 0.8,
    entryDirection: 'top',
    keyframes: {
      initial: { y: -100, opacity: 0, scale: 0.3 },
      animate: { 
        y: 0, 
        opacity: 1, 
        scale: [1, 1.1, 1],
      },
    },
    particleEffect: {
      type: 'glow',
      color: '#FBBF24', // amber-400
      count: 16,
    },
    soundMarker: 'radiate_warm',
  },
  
  '夸夸豚': {
    animationType: 'leap_splash',
    duration: 0.9,
    entryDirection: 'bottom',
    keyframes: {
      initial: { y: 150, opacity: 0, scale: 0.6 },
      animate: { 
        y: [0, -30, 0], 
        opacity: 1, 
        scale: 1,
      },
    },
    particleEffect: {
      type: 'splash',
      color: '#06B6D4', // cyan-500
      count: 10,
    },
    soundMarker: 'splash_joy',
  },
  
  '机智狐': {
    animationType: 'flash_wink',
    duration: 0.7,
    entryDirection: 'right',
    keyframes: {
      initial: { x: 100, opacity: 0, scale: 0.8, rotate: 15 },
      animate: { 
        x: 0, 
        opacity: 1, 
        scale: 1, 
        rotate: 0,
      },
    },
    particleEffect: {
      type: 'sparkle',
      color: '#EF4444', // red-500
      count: 8,
    },
    soundMarker: 'swift_appear',
  },
  
  '淡定海豚': {
    animationType: 'glide_ripple',
    duration: 1.0,
    entryDirection: 'left',
    keyframes: {
      initial: { x: -80, opacity: 0, scale: 0.9 },
      animate: { 
        x: 0, 
        opacity: 1, 
        scale: 1,
      },
    },
    particleEffect: {
      type: 'ripple',
      color: '#6366F1', // indigo-500
      count: 6,
    },
    soundMarker: 'calm_wave',
  },
  
  '织网蛛': {
    animationType: 'descend_weave',
    duration: 0.9,
    entryDirection: 'top',
    keyframes: {
      initial: { y: -120, opacity: 0, scale: 0.7 },
      animate: { 
        y: 0, 
        opacity: 1, 
        scale: 1,
      },
    },
    particleEffect: {
      type: 'thread',
      color: '#A855F7', // purple-500
      count: 8,
    },
    soundMarker: 'weave_silk',
  },
  
  '暖心熊': {
    animationType: 'step_embrace',
    duration: 1.0,
    entryDirection: 'center',
    keyframes: {
      initial: { opacity: 0, scale: 0.5 },
      animate: { 
        opacity: 1, 
        scale: [1, 1.05, 1],
      },
    },
    particleEffect: {
      type: 'heart',
      color: '#EC4899', // pink-500
      count: 10,
    },
    soundMarker: 'warm_embrace',
  },
  
  '灵感章鱼': {
    animationType: 'wave_lightbulb',
    duration: 0.9,
    entryDirection: 'center',
    keyframes: {
      initial: { opacity: 0, scale: 0.4, rotate: -20 },
      animate: { 
        opacity: 1, 
        scale: 1, 
        rotate: [0, 5, -5, 0],
      },
    },
    particleEffect: {
      type: 'star',
      color: '#8B5CF6', // violet-500
      count: 12,
    },
    soundMarker: 'idea_pop',
  },
  
  '沉思猫头鹰': {
    animationType: 'spread_feather',
    duration: 1.0,
    entryDirection: 'top',
    keyframes: {
      initial: { y: -60, opacity: 0, scale: 0.8 },
      animate: { 
        y: 0, 
        opacity: 1, 
        scale: 1,
      },
    },
    particleEffect: {
      type: 'feather',
      color: '#64748B', // slate-500
      count: 6,
    },
    soundMarker: 'wise_land',
  },
  
  '定心大象': {
    animationType: 'march_trunk',
    duration: 1.0,
    entryDirection: 'bottom',
    keyframes: {
      initial: { y: 80, opacity: 0, scale: 0.9 },
      animate: { 
        y: 0, 
        opacity: 1, 
        scale: 1,
      },
    },
    particleEffect: {
      type: 'dust',
      color: '#6B7280', // gray-500
      count: 8,
    },
    soundMarker: 'steady_step',
  },
  
  '稳如龟': {
    animationType: 'peek_steady',
    duration: 1.0,
    entryDirection: 'bottom',
    keyframes: {
      initial: { y: 40, opacity: 0, scale: 0.85 },
      animate: { 
        y: 0, 
        opacity: 1, 
        scale: 1,
      },
    },
    particleEffect: {
      type: 'bubble',
      color: '#10B981', // emerald-500
      count: 6,
    },
    soundMarker: 'patient_emerge',
  },
  
  '隐身猫': {
    animationType: 'shadow_emerge',
    duration: 0.9,
    entryDirection: 'shadow',
    keyframes: {
      initial: { opacity: 0, scale: 1.1, filter: 'blur(10px)' },
      animate: { 
        opacity: 1, 
        scale: 1, 
        filter: 'blur(0px)',
      },
    },
    particleEffect: {
      type: 'sparkle',
      color: '#6366F1', // indigo-500
      count: 6,
    },
    soundMarker: 'soft_appear',
  },
};

// Get animation config for an archetype
export function getArchetypeAnimation(archetype: string): ArchetypeAnimationConfig | null {
  return archetypeAnimations[archetype] || null;
}

// Get full archetype visual data (image, gradient, animation)
export function getArchetypeVisualData(archetype: string) {
  return {
    image: archetypeAvatars[archetype] || null,
    gradient: archetypeGradients[archetype] || 'from-purple-500 to-pink-500',
    animation: archetypeAnimations[archetype] || null,
  };
}

// Event type templates with color/effect variations
export type EventType = '饭局' | '酒局' | '游戏局' | '户外' | '文艺' | 'default';

export interface EventTypeTheme {
  primaryGradient: string;
  particleColors: string[];
  blindBoxColor: string;
  accentColor: string;
}

export const eventTypeThemes: Record<EventType, EventTypeTheme> = {
  '饭局': {
    primaryGradient: 'from-orange-400 via-red-400 to-rose-500',
    particleColors: ['#F97316', '#EF4444', '#F43F5E'],
    blindBoxColor: '#FED7AA',
    accentColor: '#EA580C',
  },
  '酒局': {
    primaryGradient: 'from-purple-400 via-violet-500 to-indigo-600',
    particleColors: ['#A855F7', '#8B5CF6', '#6366F1'],
    blindBoxColor: '#DDD6FE',
    accentColor: '#7C3AED',
  },
  '游戏局': {
    primaryGradient: 'from-cyan-400 via-blue-500 to-indigo-500',
    particleColors: ['#06B6D4', '#3B82F6', '#6366F1'],
    blindBoxColor: '#CFFAFE',
    accentColor: '#0891B2',
  },
  '户外': {
    primaryGradient: 'from-green-400 via-emerald-500 to-teal-500',
    particleColors: ['#22C55E', '#10B981', '#14B8A6'],
    blindBoxColor: '#D1FAE5',
    accentColor: '#059669',
  },
  '文艺': {
    primaryGradient: 'from-rose-400 via-pink-500 to-fuchsia-500',
    particleColors: ['#FB7185', '#EC4899', '#D946EF'],
    blindBoxColor: '#FECDD3',
    accentColor: '#DB2777',
  },
  'default': {
    primaryGradient: 'from-violet-400 via-purple-500 to-indigo-500',
    particleColors: ['#8B5CF6', '#A855F7', '#6366F1'],
    blindBoxColor: '#E9D5FF',
    accentColor: '#7C3AED',
  },
};

// Get event type theme
export function getEventTypeTheme(eventType?: string): EventTypeTheme {
  if (eventType && eventType in eventTypeThemes) {
    return eventTypeThemes[eventType as EventType];
  }
  return eventTypeThemes.default;
}

// Personalized ending messages based on archetype combinations
export interface EndingMessage {
  main: string;
  sub: string;
  compatibilityHighlight?: string;
}

export function generateEndingMessage(
  userArchetype: string,
  teammateArchetypes: string[],
  compatibilityScore?: number
): EndingMessage {
  const archetypeNames = [userArchetype, ...teammateArchetypes].join('、');
  
  // High compatibility (80%+)
  if (compatibilityScore && compatibilityScore >= 80) {
    return {
      main: '你的社交建筑师已完成组局！',
      sub: `${userArchetype} 与 ${teammateArchetypes[0] || '队友'} 的绝佳搭配`,
      compatibilityHighlight: `社交契合度 ${compatibilityScore}%`,
    };
  }
  
  // Good compatibility (60-79%)
  if (compatibilityScore && compatibilityScore >= 60) {
    return {
      main: '小悦为你精心安排了这一局',
      sub: `专为${archetypeNames}打造的夜晚，即将开启`,
      compatibilityHighlight: `社交契合度 ${compatibilityScore}%`,
    };
  }
  
  // Default message
  return {
    main: '你的社交建筑师已完成组局！',
    sub: '期待与新朋友的精彩相遇',
  };
}

// Teammate entry order based on compatibility (highest last for dramatic effect)
export interface TeammateEntry {
  archetype: string;
  userId: string;
  displayName: string;
  compatibilityScore: number;
  entryDelay: number; // ms
  isHighlight: boolean; // True for last (highest compatibility)
}

/**
 * Calculate teammate entry order for Act 3 animation
 * Note: teammates array should already exclude the current user (filtered by userId, not archetype)
 * This function handles the entry animation ordering - teammates with same archetype are allowed
 */
export function calculateTeammateEntryOrder(
  userArchetype: string,
  teammates: Array<{ archetype: string; userId: string; displayName: string; compatibilityScore?: number }>
): TeammateEntry[] {
  // Handle empty teammates case
  if (!teammates || teammates.length === 0) {
    return [];
  }
  
  // Sort by compatibility (ascending, so highest is last for dramatic effect)
  const sorted = [...teammates].sort((a, b) => 
    (a.compatibilityScore || 50) - (b.compatibilityScore || 50)
  );
  
  const baseDelay = 300; // ms between each entry
  
  return sorted.map((teammate, index) => ({
    archetype: teammate.archetype,
    userId: teammate.userId,
    displayName: teammate.displayName,
    compatibilityScore: teammate.compatibilityScore || 50,
    entryDelay: index * baseDelay,
    isHighlight: index === sorted.length - 1,
  }));
}

// Teammate circle micro-interactions during Act 3
export type MicroInteractionType = 'wave' | 'nod' | 'glance';

export const getMicroInteraction = (index: number, total: number): MicroInteractionType => {
  // Distribute micro-interactions evenly: wave -> nod -> glance pattern
  const pattern: MicroInteractionType[] = ['wave', 'nod', 'glance', 'wave', 'nod', 'glance'];
  return pattern[index % pattern.length];
};

export const getMicroInteractionAnimation = (type: MicroInteractionType, index: number, totalDelay: number = 1.8) => {
  const stagger = index * 0.15; // Small stagger between teammates
  
  switch (type) {
    case 'wave':
      return {
        initial: { rotate: 0 },
        animate: {
          rotate: [0, 15, -15, 15, -10, 0],
        },
        transition: {
          delay: totalDelay + stagger,
          duration: 0.8,
          ease: 'easeInOut',
          repeat: 2,
          repeatDelay: 3,
        }
      };
    case 'nod':
      return {
        initial: { rotateY: 0 },
        animate: {
          rotateY: [0, 8, -8, 8, -5, 0],
        },
        transition: {
          delay: totalDelay + stagger + 0.3,
          duration: 0.6,
          ease: 'easeInOut',
          repeat: 2,
          repeatDelay: 3.2,
        }
      };
    case 'glance':
      return {
        initial: { scale: 1 },
        animate: {
          scale: [1, 1.08, 1],
        },
        transition: {
          delay: totalDelay + stagger + 0.6,
          duration: 0.5,
          ease: 'easeInOut',
          repeat: 2,
          repeatDelay: 3.5,
        }
      };
  }
};
