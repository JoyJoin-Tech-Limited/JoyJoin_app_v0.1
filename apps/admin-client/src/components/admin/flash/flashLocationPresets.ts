export type FlashLocationPreset = {
  code: string;
  name: string;
  district: string;
  addressHint: string;
  npcSlugs: string[];
  tags: string[];
  safetyNotes: string;
};

export function isFlashLocationPresetFulfilled(
  preset: FlashLocationPreset,
  existingLocationNames: ReadonlySet<string>,
): boolean {
  if (existingLocationNames.has(preset.name)) return true;

  // The reviewed database row predates the preset copy change from
  // "公共街区" to "公共街巷"; both names represent the same Nantou location.
  return preset.code === "NS-NANTOU-PUBLIC-LANES"
    && [...existingLocationNames].some((name) => name.includes("\u5357\u5934\u53e4\u57ce"));
}

const COMMON_PUBLIC_SPACE_RULES =
  "仅限开放、可安全停留且不阻塞通道的公共区域；无需进店或消费，不要求扫码、拍照、评价或与店员交流。现场关闭、拥挤、施工或照明不足时停用。";

export const FLASH_LOCATION_PRESETS: FlashLocationPreset[] = [
  {
    code: "NS-SW-CULTURE-PLAZA",
    name: "海上世界文化艺术中心外围广场",
    district: "南山区",
    addressHint: "海上世界文化艺术中心外围开放广场",
    npcSlugs: ["alang", "momo"],
    tags: ["滨水", "建筑", "艺术", "安静漫游", "公共广场"],
    safetyNotes: `仅使用场馆外围开放广场与公共步行区，不进入收费展览空间。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "NS-NANTOU-PUBLIC-LANES",
    name: "南头古城公共街巷",
    district: "南山区",
    addressHint: "南头古城开放公共街巷",
    npcSlugs: ["alang", "shiqi"],
    tags: ["旧街", "建筑", "年份", "招牌文字", "小店外观"],
    safetyNotes: `只观察公共街巷、建筑外观和公开展示，不拍摄居民，不进入店铺或院落。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "NS-SHEKOU-PUBLIC-STREETS",
    name: "海上世界广场及商业街公共区域",
    district: "南山区",
    addressHint: "海上世界广场及商业街户外公共区域",
    npcSlugs: ["alang"],
    tags: ["海风", "夜生活氛围", "商业街", "城市变化", "公共街区"],
    safetyNotes: `名称和引导不得指向具体酒吧；仅在户外公共街区或外围广场活动，避免深夜与任何酒精引导。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "NS-MIXC-WORLD-STREETS",
    name: "万象天地开放式街区",
    district: "南山区",
    addressHint: "深圳万象天地开放式公共街区",
    npcSlugs: ["lizi", "shiqi"],
    tags: ["橱窗", "建筑细节", "公共艺术", "城市观察", "轻量探店"],
    safetyNotes: `任务只观察公开橱窗、建筑和公共艺术，不进入具体店铺。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "FT-COCOPARK-PUBLIC-STREETS",
    name: "COCO Park 周边公共街区",
    district: "福田区",
    addressHint: "福田 COCO Park 周边开放公共街区",
    npcSlugs: ["lizi"],
    tags: ["城市活力", "夜生活氛围", "橱窗", "公共街区"],
    safetyNotes: `只使用商场外围和周边公共街区，避开深夜、具体酒吧内部及酒精相关任务。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "BA-OHBAY-PUBLIC-STREETS",
    name: "欢乐港湾商业街区公共区域",
    district: "宝安区",
    addressHint: "欢乐港湾商业街区及公共休息区域",
    npcSlugs: ["lizi", "atuan"],
    tags: ["滨水", "夜间氛围", "橱窗", "城市活力", "公共休息区"],
    safetyNotes: `优先选择有座位、照明良好并远离临水边缘的公共休息区。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "FT-UPPERHILLS-LOFT",
    name: "深业上城 LOFT 公共街区",
    district: "福田区",
    addressHint: "深业上城 LOFT 开放公共街区及公共连廊",
    npcSlugs: ["momo", "shiqi", "atuan"],
    tags: ["设计", "生活方式", "公共连廊", "建筑细节", "轻探索"],
    safetyNotes: `默默与阿团优先安排相对安静、有座位的公共连廊；拾柒使用公开建筑细节。商场关闭后停用。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "FT-BOOKCITY-READING",
    name: "深圳书城中心城公共阅读区",
    district: "福田区",
    addressHint: "深圳书城中心城开放公共阅读区域",
    npcSlugs: ["momo", "atuan"],
    tags: ["阅读", "文化发现", "安静", "有座位", "室内避暑"],
    safetyNotes: `保持安静，不占用优先座位，不要求购书；以现场开放时间为准，闭馆后自动停用。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "NS-HOUHAI-PUBLIC-AREA",
    name: "后海商业公共区",
    district: "南山区",
    addressHint: "后海商业区开放公共空间",
    npcSlugs: ["lizi", "shiqi"],
    tags: ["现代建筑", "公共艺术", "城市观察", "公共空间"],
    safetyNotes: `仅选择开放广场、公共艺术周边或宽阔步行区，不把具体商业门店作为目的地。${COMMON_PUBLIC_SPACE_RULES}`,
  },
  {
    code: "BA-UNIWALK-PUBLIC-AREA",
    name: "宝安壹方城公共区域",
    district: "宝安区",
    addressHint: "宝安壹方城开放公共区域",
    npcSlugs: ["lizi", "atuan"],
    tags: ["橱窗观察", "室内避暑", "有座位", "轻量探店"],
    safetyNotes: `只使用允许停留的商场公共空间，不承诺永久免费或全天开放；闭店前预留离场时间。${COMMON_PUBLIC_SPACE_RULES}`,
  },
];

export const FLASH_LOCATION_OPERATIONS_NOTICE = [
  "酒吧街只写“公共街区”或“外围广场”，不得使用具体酒吧名称。",
  "商场、书城和文化空间以现场开放时间为准，不承诺永久免费或全天开放。",
  "任务不得要求消费、进店、扫码、拍照、评价或与店员交流。",
  "闭店、闭馆、施工、拥挤或照明不足时停用地点，不安排夜间滞留。",
  "保存前必须用腾讯地图重新选点；通过深圳行政区校验后仍需人工安全审核。",
] as const;

