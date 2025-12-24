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
  heat: 'hot' | 'active' | 'normal';
  clusterId: string;
}

export interface DistrictCluster {
  id: string;
  name: string;
  displayName: string;
  description?: string;
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
    name: '南山区',
    displayName: '南山区',
    description: '科技园、后海CBD聚集地',
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
    name: '福田区',
    displayName: '福田区',
    description: '深圳中心商务区',
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

export function getDistrictIdsByCluster(clusterId: string): string[] {
  const cluster = getClusterById(clusterId);
  return cluster?.districts.map(d => d.id) || [];
}

export function getClusterIdByDistrictId(districtId: string): string | undefined {
  const district = getDistrictById(districtId);
  return district?.clusterId;
}
