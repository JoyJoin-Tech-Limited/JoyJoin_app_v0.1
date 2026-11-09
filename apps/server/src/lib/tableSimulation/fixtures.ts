import type { SimulationSeatInput } from './types';

export interface TableSimulationFixture {
  name: string;
  description: string;
  roster: SimulationSeatInput[];
}

/**
 * Deterministic rosters used by the CLI and the tests.
 * These are synthetic — no real user rows are involved.
 */
export const TABLE_SIMULATION_FIXTURES: Record<string, TableSimulationFixture> = {
  'corgi-mix': {
    name: 'corgi-mix',
    description: '均衡桌：一个社牛带五个中等能量的人。',
    roster: [
      { primaryArchetype: 'corgi', interests: ['徒步', '摄影', '桌游'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'koala', interests: ['电影', '烘焙'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'owl', interests: ['读书', '博物馆'], tableVibePreference: '深度交流' },
      { primaryArchetype: 'dolphin_calm', interests: ['潜水', '旅行'], tableVibePreference: '不限' },
      { primaryArchetype: 'fox', interests: ['露营', '咖啡'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'elephant', interests: ['健身', '做饭'], tableVibePreference: '深度交流' },
    ],
  },
  'quiet-table': {
    name: 'quiet-table',
    description: '安静桌：慢热和低能量居多，最容易冷场。',
    roster: [
      { primaryArchetype: 'turtle', interests: ['读书', '散步'], tableVibePreference: '深度交流' },
      { primaryArchetype: 'cat', interests: ['动漫'], tableVibePreference: '不限' },
      { primaryArchetype: 'owl', interests: ['纪录片', '天文'], tableVibePreference: '深度交流' },
      { primaryArchetype: 'koala', interests: ['音乐', '烘焙'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'elephant', interests: ['跑步'], tableVibePreference: '深度交流' },
      { primaryArchetype: 'owl', interests: ['写作', '展览'], tableVibePreference: '深度交流' },
    ],
  },
  'loud-table': {
    name: 'loud-table',
    description: '高能桌：三个高能量抢话，容易变成两个人的局。',
    roster: [
      { primaryArchetype: 'corgi', interests: ['派对', '街舞', '旅行'], tableVibePreference: '游戏互动' },
      { primaryArchetype: 'rooster', interests: ['综艺', '美食'], tableVibePreference: '游戏互动' },
      { primaryArchetype: 'fox', interests: ['剧本杀', '露营'], tableVibePreference: '游戏互动' },
      { primaryArchetype: 'spider', interests: ['创业', '咖啡'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'hamster_praise', interests: ['宠物', '烘焙'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'dolphin_calm', interests: ['电影'], tableVibePreference: '不限' },
    ],
  },
  'clash-table': {
    name: 'clash-table',
    description: '冲突桌：高能量直球和低能量慢热混在一起。',
    roster: [
      { primaryArchetype: 'corgi', interests: ['健身', '投资'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'turtle', interests: ['读书', '茶'], tableVibePreference: '深度交流' },
      { primaryArchetype: 'fox', interests: ['创业', '滑雪'], tableVibePreference: '游戏互动' },
      { primaryArchetype: 'koala', interests: ['电影', '猫'], tableVibePreference: '轻松聊天' },
      { primaryArchetype: 'octopus', interests: ['科幻', '播客'], tableVibePreference: '深度交流' },
      { primaryArchetype: 'elephant', interests: ['徒步', '做饭'], tableVibePreference: '深度交流' },
    ],
  },
};

export const DEFAULT_TABLE_SIMULATION_FIXTURE = 'corgi-mix';

export function getFixture(name: string): TableSimulationFixture {
  const fixture = TABLE_SIMULATION_FIXTURES[name];
  if (!fixture) {
    throw new Error(
      `未知 fixture: ${name}。可用：${Object.keys(TABLE_SIMULATION_FIXTURES).join(', ')}`,
    );
  }
  return fixture;
}
