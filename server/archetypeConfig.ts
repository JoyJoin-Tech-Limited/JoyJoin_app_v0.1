/**
 * 12个社交氛围原型的六维特质分数和洞察配置
 */

export const roleTraits: Record<string, {
  affinity: number;
  openness: number;
  conscientiousness: number;
  emotionalStability: number;
  extraversion: number;
  positivity: number;
}> = {
  "开心柯基": { affinity: 8, openness: 8, conscientiousness: 5, emotionalStability: 7, extraversion: 10, positivity: 10 },
  "太阳鸡": { affinity: 9, openness: 7, conscientiousness: 7, emotionalStability: 9, extraversion: 9, positivity: 10 },
  "夸夸豚": { affinity: 9, openness: 6, conscientiousness: 6, emotionalStability: 7, extraversion: 8, positivity: 10 },
  "机智狐": { affinity: 7, openness: 10, conscientiousness: 6, emotionalStability: 7, extraversion: 8, positivity: 8 },
  "淡定海豚": { affinity: 8, openness: 7, conscientiousness: 8, emotionalStability: 10, extraversion: 7, positivity: 8 },
  "织网蛛": { affinity: 10, openness: 8, conscientiousness: 7, emotionalStability: 8, extraversion: 7, positivity: 7 },
  "暖心熊": { affinity: 10, openness: 7, conscientiousness: 7, emotionalStability: 7, extraversion: 7, positivity: 8 },
  "灵感章鱼": { affinity: 6, openness: 10, conscientiousness: 5, emotionalStability: 6, extraversion: 7, positivity: 7 },
  "沉思猫头鹰": { affinity: 6, openness: 9, conscientiousness: 9, emotionalStability: 8, extraversion: 5, positivity: 6 },
  "定心大象": { affinity: 8, openness: 6, conscientiousness: 9, emotionalStability: 10, extraversion: 5, positivity: 7 },
  "稳如龟": { affinity: 7, openness: 8, conscientiousness: 8, emotionalStability: 9, extraversion: 3, positivity: 6 },
  "隐身猫": { affinity: 5, openness: 6, conscientiousness: 7, emotionalStability: 7, extraversion: 2, positivity: 5 },
};

export const roleInsights: Record<string, {
  strengths: string;
  challenges: string;
  idealFriendTypes: string[];
}> = {
  "开心柯基": {
    strengths: "你是团队的永动机！擅长用幽默和活力点燃气氛，让陌生人瞬间打开心扉。你的破冰能力一流，能快速让聚会从尴尬走向欢乐。",
    challenges: "有时能量过于充沛，可能让内向的朋友感到压力；需要注意倾听和给予他人发言空间，避免过度主导对话。",
    idealFriendTypes: ["暖心熊", "夸夸豚", "淡定海豚"],
  },
  "太阳鸡": {
    strengths: "你是人间小暖气！散发稳定温暖的正能量，让每个人都感到被照顾和重视。你的乐观感染力强，能提升整体幸福感。",
    challenges: "可能过于追求和谐而忽视冲突的建设性；有时需要允许一些「真实的不舒服」来促进深度交流。",
    idealFriendTypes: ["淡定海豚", "暖心熊", "定心大象"],
  },
  "夸夸豚": {
    strengths: "你是掌声发动机！善于发现和放大他人的优点，提供积极反馈和鼓励。你的热情回应能增强团队信心，让害羞的人也敢发声。",
    challenges: "可能过于避免批评而缺乏真实意见；需要在鼓励他人的同时也勇于表达建设性反馈。",
    idealFriendTypes: ["沉思猫头鹰", "稳如龟", "暖心熊"],
  },
  "机智狐": {
    strengths: "你是城市探险家！好奇心强、信息灵通，总能发现新鲜有趣的体验。你勇于尝试，能为聚会带来惊喜和新鲜感。",
    challenges: "可能过于追逐新鲜而缺乏深度；需要平衡探索广度与体验深度，避免浅尝辄止。",
    idealFriendTypes: ["灵感章鱼", "织网蛛", "太阳鸡"],
  },
  "淡定海豚": {
    strengths: "你是气氛调频手！情商高、应变力强，善于平衡群体氛围。你能察觉微妙的情绪波动，及时化解潜在冲突。",
    challenges: "可能过于关注平衡而缺乏个人立场；有时需要勇于表达真实想法，而非只是协调他人。",
    idealFriendTypes: ["定心大象", "开心柯基", "太阳鸡"],
  },
  "织网蛛": {
    strengths: "你是社交黏合剂！观察敏锐，善于发现不同人之间的共同点并建立连接。你的人脉广泛，能构建丰富的社交网络。",
    challenges: "可能过于networking而缺乏深度关系；需要平衡广度连接与深度友谊，避免流于表面。",
    idealFriendTypes: ["机智狐", "暖心熊", "淡定海豚"],
  },
  "暖心熊": {
    strengths: "你是故事收藏家！善于倾听和共情，能通过故事建立深度情感连接。你的温暖包容让人愿意敞开心扉。",
    challenges: "可能过于感性而忽视理性分析；需要平衡情感表达与客观思考，避免过度共情导致疲惫。",
    idealFriendTypes: ["沉思猫头鹰", "开心柯基", "定心大象"],
  },
  "灵感章鱼": {
    strengths: "你是创意喷射器！思维跳跃、联想丰富，能激发集体脑暴。你的多线程发散思维为团队带来无穷创意。",
    challenges: "可能过于发散而缺乏落地性；需要注意收敛思维，将创意转化为可执行的方案。",
    idealFriendTypes: ["机智狐", "定心大象", "沉思猫头鹰"],
  },
  "沉思猫头鹰": {
    strengths: "你是哲学带师！逻辑性强、善于提问，能提升对话质量并激发深度思考。你的洞察力能发现盲点。",
    challenges: "可能过于严肃而缺乏轻松感；需要平衡深度与趣味性，避免让讨论过于学术化。",
    idealFriendTypes: ["稳如龟", "暖心熊", "灵感章鱼"],
  },
  "定心大象": {
    strengths: "你是团队定盘星！稳重可靠、包容豁达，给人强烈的安全感。你的稳定支持是团队的后盾。",
    challenges: "可能过于稳定而缺乏变化；有时需要适当冒险和尝试新事物，避免过于保守。",
    idealFriendTypes: ["淡定海豚", "暖心熊", "太阳鸡"],
  },
  "稳如龟": {
    strengths: "你是人间观察家！思考深入、言简意赅，能提供独到见解和深度洞察。你的低频发言往往一针见血。",
    challenges: "可能过于沉默而难以被理解；需要适当增加表达频率，让他人了解你的智慧。",
    idealFriendTypes: ["隐身猫", "沉思猫头鹰", "暖心熊"],
  },
  "隐身猫": {
    strengths: "你是安静陪伴者！存在感低但不施加压力，享受旁观并提供轻松氛围。你的安静让他人感到自在。",
    challenges: "可能过于隐身而被忽视；需要适当表达自己的需求和想法，避免完全边缘化。",
    idealFriendTypes: ["稳如龟", "定心大象", "暖心熊"],
  },
};
