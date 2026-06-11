/**
 * 深圳商圈数据结构
 * 用于发现页定位选择（片区）、报名时商圈多选、场地入驻商圈选择
 * 
 * 片区划分：
 * - 南山区：包含南山片区的所有商圈 + 华侨城 + 前海
 * - 福田区：包含福田片区的所有商圈
 */

export interface District {
  id: string;
  name: string;
  shortName?: string;
  heat: HeatLevel;
  clusterId: string; // 所属片区 ID
}

export interface DistrictCluster {
  id: string;
  name: string;
  displayName: string; // 用于发现页显示的名称（如"南山区"）
  districts: District[];
}

export type HeatLevel = 'hot' | 'active' | 'normal' | 'pending';

export const heatConfig: Record<HeatLevel, { label: string; iconName: 'flame' | 'zap' | 'none'; color: string }> = {
  hot: { label: '热门', iconName: 'flame', color: 'text-orange-500' },
  active: { label: '活跃', iconName: 'zap', color: 'text-yellow-500' },
  normal: { label: '', iconName: 'none', color: '' },
  pending: { label: '即将开放', iconName: 'none', color: '' },
};

// 深圳片区数据 - 只有南山和福田两个片区
export const shenzhenClusters: DistrictCluster[] = [
  {
    id: 'nanshan',
    name: '南山区',
    displayName: '南山区',
    districts: [
      { id: 'keji', name: '科技园', heat: 'hot', clusterId: 'nanshan' },
      { id: 'houhai', name: '后海', heat: 'hot', clusterId: 'nanshan' },
      { id: 'shenzhenwan', name: '深圳湾', heat: 'active', clusterId: 'nanshan' },
      { id: 'shekou', name: '蛇口', heat: 'active', clusterId: 'nanshan' },
      { id: 'qianhai', name: '前海', heat: 'active', clusterId: 'nanshan' },
      { id: 'oct', name: '华侨城', heat: 'hot', clusterId: 'nanshan' },
    ],
  },
  {
    id: 'futian',
    name: '福田',
    displayName: '福田区',
    districts: [
      { id: 'chegongmiao', name: '车公庙', heat: 'hot', clusterId: 'futian' },
      { id: 'gouwugongyuan', name: '购物公园·会展', heat: 'active', clusterId: 'futian' },
      { id: 'meilin', name: '梅林', heat: 'normal', clusterId: 'futian' },
    ],
  },
  {
    id: 'external',
    name: '其他区域',
    displayName: '即将开放',
    districts: [
      { id: 'luohu', name: '罗湖区', heat: 'pending', clusterId: 'external' },
      { id: 'baoan', name: '宝安区', heat: 'pending', clusterId: 'external' },
      { id: 'longgang', name: '龙岗区', heat: 'pending', clusterId: 'external' },
      { id: 'yantian', name: '盐田区', heat: 'pending', clusterId: 'external' },
      { id: 'longhua', name: '龙华区', heat: 'pending', clusterId: 'external' },
      { id: 'pingshan', name: '坪山区', heat: 'pending', clusterId: 'external' },
      { id: 'guangming', name: '光明区', heat: 'pending', clusterId: 'external' },
      { id: 'dapeng', name: '大鹏新区', heat: 'pending', clusterId: 'external' },
    ],
  },
];

// 邻近商圈映射 - 用于推荐
export const adjacencyMap: Record<string, string[]> = {
  keji: ['houhai', 'shenzhenwan', 'oct'],
  houhai: ['keji', 'shenzhenwan', 'oct', 'qianhai'],
  shenzhenwan: ['keji', 'houhai', 'shekou'],
  shekou: ['shenzhenwan', 'qianhai'],
  qianhai: ['houhai', 'shekou'],
  oct: ['keji', 'houhai', 'chegongmiao'],
  chegongmiao: ['oct', 'gouwugongyuan'],
  gouwugongyuan: ['chegongmiao', 'meilin'],
  meilin: ['gouwugongyuan'],
};

// 辅助函数
export function getAllDistricts(): District[] {
  return shenzhenClusters.flatMap(cluster => cluster.districts);
}

export function getDistrictById(id: string): District | undefined {
  return getAllDistricts().find(d => d.id === id);
}

export function getClusterById(id: string): DistrictCluster | undefined {
  return shenzhenClusters.find(c => c.id === id);
}

export function getAdjacentDistricts(districtId: string): District[] {
  const adjacentIds = adjacencyMap[districtId] || [];
  return adjacentIds.map(id => getDistrictById(id)).filter((d): d is District => d !== undefined);
}

export function getDistrictsByCluster(clusterId: string): District[] {
  const cluster = getClusterById(clusterId);
  return cluster?.districts || [];
}

// 根据片区ID获取该片区所有商圈ID
export function getDistrictIdsByCluster(clusterId: string): string[] {
  const cluster = getClusterById(clusterId);
  return cluster?.districts.map(d => d.id) || [];
}

// 获取商圈所属的片区ID
export function getClusterIdByDistrictId(districtId: string): string | undefined {
  const district = getDistrictById(districtId);
  return district?.clusterId;
}

// ═════════════════════════════════════════════════════════════════════════════
// 区域发现策略 — Discovery Geo Mode
// ═════════════════════════════════════════════════════════════════════════════

export type GeoDiscoveryMode = 'strict' | 'relaxed';

export const DEFAULT_DISCOVERY_MODE: GeoDiscoveryMode = 'relaxed';

/** 当场地数量 >= 此阈值时，建议切换到 strict 模式 */
export const STRICT_MODE_VENUE_THRESHOLD = 10;

/** 行政区名称 → JoyJoin clusterId（用于 pool.district 区级别映射） */
export const districtNameToClusterId: Record<string, string> = {
  '南山区': 'nanshan',
  '福田区': 'futian',
};

/** 深圳外部行政区 → 最近的 JoyJoin clusterId（用于 GPS 反查外部区映射） */
export const externalDistrictToClusterId: Record<string, string> = {
  '罗湖区': 'futian',
  '宝安区': 'nanshan',
  '龙岗区': 'futian',
  '盐田区': 'futian',
  '龙华区': 'futian',
  '坪山区': 'futian',
  '光明区': 'nanshan',
  '大鹏新区': 'nanshan',
};

/**
 * Cluster 级别通勤邻近度（分钟）
 * 基于深圳地铁/地理常识，用于发现页活动排序
 * 当数据模型升级到包含 venue district_id 后，可替换为 district-level proximity
 */
export const clusterProximityMap: Record<string, Record<string, number>> = {
  nanshan: { nanshan: 0, futian: 20 },
  futian: { nanshan: 20, futian: 0 },
};

/**
 * 标准化行政区名称（去除首尾空格、统一为简体中文格式）
 * 处理 GPS 反查或数据库中可能出现的格式差异
 */
function normalizeDistrictName(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

/** 根据行政区名称获取 clusterId（支持 JoyJoin 内部区 + 外部区） */
export function getClusterIdByDistrictName(districtName: string): string | undefined {
  const normalized = normalizeDistrictName(districtName);
  return districtNameToClusterId[normalized] ?? externalDistrictToClusterId[normalized];
}

/** 计算两个 cluster 之间的通勤分钟数 */
export function getClusterProximity(fromClusterId: string, toClusterId: string): number {
  return clusterProximityMap[fromClusterId]?.[toClusterId] ?? 999;
}

/**
 * 根据用户参考 cluster 对活动池进行 proximity 排序
 * 优先级：同 cluster > 邻近 cluster > 其他
 * 同 proximity 内按时间紧迫度（dateTime 近者优先）
 *
 * 性能优化：预计算排序键，避免在比较器内重复解析 Date 和查询映射表
 */
export function sortPoolsByProximity<T extends { district?: string | null; dateTime?: string | Date | null }>(
  pools: T[],
  referenceClusterId: string | null | undefined
): T[] {
  if (!referenceClusterId || pools.length <= 1) {
    // 无参考位置或单元素：按时间排序（即将开始的活动优先）
    if (pools.length <= 1) return [...pools];
    return [...pools].sort((a, b) => {
      const tA = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
      const tB = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
      return tA - tB;
    });
  }

  // 预计算排序键：避免在 comparator 内重复调用 getClusterIdByDistrictName / new Date / getClusterProximity
  const keys = pools.map((pool) => {
    const clusterId = pool.district ? getClusterIdByDistrictName(pool.district) : null;
    const proximity = clusterId ? getClusterProximity(referenceClusterId, clusterId) : 999;
    const timeMs = pool.dateTime ? new Date(pool.dateTime).getTime() : Infinity;
    return { pool, proximity, timeMs };
  });

  keys.sort((a, b) => {
    if (a.proximity !== b.proximity) {
      return a.proximity - b.proximity;
    }
    return a.timeMs - b.timeMs;
  });

  return keys.map((k) => k.pool);
}

/** 检测当前发现策略模式（基于场地数量） */
export function resolveGeoDiscoveryMode(activeVenueCount: number): GeoDiscoveryMode {
  return activeVenueCount >= STRICT_MODE_VENUE_THRESHOLD ? 'strict' : 'relaxed';
}
