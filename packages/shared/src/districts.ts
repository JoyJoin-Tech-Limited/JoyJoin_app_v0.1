/**
 * 深圳商圈数据结构
 * 用于发现页定位选择、报名时商圈多选、场地入驻商圈选择
 */

export interface District {
  id: string;
  name: string;
  shortName?: string;
  heat: 'hot' | 'active' | 'normal';
  clusterId: string;
}

export interface DistrictCluster {
  id: string;
  name: string;
  districts: District[];
}

export type HeatLevel = 'hot' | 'active' | 'normal';

export const heatConfig: Record<HeatLevel, { label: string; iconName: 'flame' | 'zap' | 'none'; color: string }> = {
  hot: { label: '热门', iconName: 'flame', color: 'text-orange-500' },
  active: { label: '活跃', iconName: 'zap', color: 'text-yellow-500' },
  normal: { label: '', iconName: 'none', color: '' },
};

export const shenzhenClusters: DistrictCluster[] = [
  {
    id: 'nanshan',
    name: '南山社交走廊',
    districts: [
      { id: 'keji', name: '科技园', heat: 'hot', clusterId: 'nanshan' },
      { id: 'houhai', name: '后海', heat: 'hot', clusterId: 'nanshan' },
      { id: 'shenzhenwan', name: '深圳湾', heat: 'active', clusterId: 'nanshan' },
      { id: 'shekou', name: '蛇口', heat: 'active', clusterId: 'nanshan' },
    ],
  },
  {
    id: 'qianhai',
    name: '前海',
    districts: [
      { id: 'qianhai', name: '前海深港城', heat: 'active', clusterId: 'qianhai' },
    ],
  },
  {
    id: 'oct',
    name: '华侨城',
    districts: [
      { id: 'oct', name: '华侨城', heat: 'hot', clusterId: 'oct' },
    ],
  },
  {
    id: 'futian',
    name: '福田',
    districts: [
      { id: 'chegongmiao', name: '车公庙', heat: 'hot', clusterId: 'futian' },
      { id: 'gouwugongyuan', name: '购物公园·会展', heat: 'active', clusterId: 'futian' },
      { id: 'meilin', name: '梅林', heat: 'normal', clusterId: 'futian' },
    ],
  },
];

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
