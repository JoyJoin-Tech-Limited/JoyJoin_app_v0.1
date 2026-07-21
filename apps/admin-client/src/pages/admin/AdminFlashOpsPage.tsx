import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Database,
  FlaskConical,
  Gift,
  MapPin,
  PackageOpen,
  PlayCircle,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type FlashTaskType = "city_exploration" | "place_discovery" | "story" | "city_easter_egg";
type FlashTaskStatus = "draft" | "pending" | "running" | "ended" | "archived";
type LocationStatus = "active" | "paused" | "retired";
type RewardType = "white_gear" | "story_record" | "trend_value" | "growth_reward";
type ConsistencyStatus = "pass" | "suggest" | "forbid";

interface FlashTask {
  id: string;
  name: string;
  brief: string;
  type: FlashTaskType;
  aiRoleId: string;
  locationId: string;
  completionCondition: string;
  rewardId: string;
  startAt: string;
  endAt: string;
  status: FlashTaskStatus;
}

interface TaskTemplate {
  id: string;
  name: string;
  type: FlashTaskType;
  allowedObjectives: string;
  recommendedLocationType: string;
  recommendedRewardType: RewardType;
  forbiddenContent: string;
}

interface AiRole {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  languageStyle: string;
  likes: string;
  dislikes: string;
  forbiddenBehaviors: string;
  recommendedTaskTypes: FlashTaskType[];
  currentArea: string;
  appearancePlan: string;
  historyTrace: string[];
}

interface FlashLocation {
  id: string;
  name: string;
  region: string;
  type: string;
  latitude: string;
  longitude: string;
  triggerRadiusMeters: number;
  openHours: string;
  status: LocationStatus;
}

interface FlashReward {
  id: string;
  name: string;
  type: RewardType;
  amount: number;
  firstRewardProtected: boolean;
  description: string;
}

interface EquipmentItem {
  id: string;
  name: string;
  rarity: "normal" | "rare";
  probability: number;
  fragmentValue: number;
  status: "active" | "paused";
}

interface ShopEquipmentPool {
  id: string;
  shopName: string;
  poolName: string;
  equipment: EquipmentItem[];
}

interface TestLog {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

interface FlashOpsState {
  tasks: FlashTask[];
  templates: TaskTemplate[];
  roles: AiRole[];
  locations: FlashLocation[];
  rewards: FlashReward[];
  equipmentPools: ShopEquipmentPool[];
  testLogs: TestLog[];
}

const STORAGE_KEY = "joyjoin-admin-flash-ops-v1";

const taskTypeLabels: Record<FlashTaskType, string> = {
  city_exploration: "城市探索任务",
  place_discovery: "地点发现任务",
  story: "剧情任务",
  city_easter_egg: "城市彩蛋任务",
};

const taskStatusLabels: Record<FlashTaskStatus, string> = {
  draft: "草稿",
  pending: "待上线",
  running: "进行中",
  ended: "已结束",
  archived: "归档",
};

const rewardTypeLabels: Record<RewardType, string> = {
  white_gear: "固定白装",
  story_record: "故事记录",
  trend_value: "趋势值",
  growth_reward: "固定成长奖励",
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const seedState: FlashOpsState = {
  tasks: [
    {
      id: "task-cafe-clue",
      name: "在永康路找到第一枚城市线索",
      brief: "用户到达咖啡店 5 米范围内，悦仔触发轻任务并发放固定白装。",
      type: "place_discovery",
      aiRoleId: "role-yuezai",
      locationId: "loc-yongkang-cafe",
      completionCondition: "GPS 距离小于 5 米并点击完成打卡",
      rewardId: "reward-white-gear",
      startAt: "2026-07-21T10:00",
      endAt: "2026-08-20T22:00",
      status: "running",
    },
    {
      id: "task-story-lane",
      name: "武康路黄昏剧情彩蛋",
      brief: "黄昏时间段出现 AI 角色，引导用户收集一段城市故事。",
      type: "story",
      aiRoleId: "role-city-cat",
      locationId: "loc-wukang-road",
      completionCondition: "18:00-20:30 到达触发区域并完成三句对话",
      rewardId: "reward-story",
      startAt: "2026-07-25T18:00",
      endAt: "2026-08-08T20:30",
      status: "pending",
    },
  ],
  templates: [
    {
      id: "tpl-explore",
      name: "城市探索",
      type: "city_exploration",
      allowedObjectives: "发现街区、拍照打卡、完成轻量对话",
      recommendedLocationType: "街区、公园、历史建筑",
      recommendedRewardType: "growth_reward",
      forbiddenContent: "禁止要求用户进入收费或危险区域",
    },
    {
      id: "tpl-clue",
      name: "寻找线索",
      type: "place_discovery",
      allowedObjectives: "到达指定地点、识别地标、回答线索问题",
      recommendedLocationType: "咖啡店、书店、城市地标",
      recommendedRewardType: "white_gear",
      forbiddenContent: "禁止收集隐私信息或引导线下交易",
    },
    {
      id: "tpl-story",
      name: "城市故事",
      type: "story",
      allowedObjectives: "对话、剧情推进、收集故事片段",
      recommendedLocationType: "老街、展览、公共文化空间",
      recommendedRewardType: "story_record",
      forbiddenContent: "禁止使用恐吓、歧视或过度营销内容",
    },
    {
      id: "tpl-egg",
      name: "彩蛋发现",
      type: "city_easter_egg",
      allowedObjectives: "限时触发、稀有奖励、二次访问",
      recommendedLocationType: "节日场景、快闪活动点",
      recommendedRewardType: "trend_value",
      forbiddenContent: "禁止诱导用户长时间逗留堵塞公共空间",
    },
  ],
  roles: [
    {
      id: "role-yuezai",
      name: "悦仔",
      avatar: "悦",
      personality: "热情、好奇、轻松带路",
      languageStyle: "短句、鼓励式、带一点城市探险感",
      likes: "新鲜地点、街角故事、用户第一次完成任务",
      dislikes: "强迫打卡、重复路线、商业硬广",
      forbiddenBehaviors: "不得要求用户分享隐私；不得诱导危险移动",
      recommendedTaskTypes: ["city_exploration", "place_discovery", "city_easter_egg"],
      currentArea: "上海徐汇",
      appearancePlan: "工作日傍晚出现在咖啡街区，周末下午出现在公园和展览附近",
      historyTrace: ["2026-07-12 永康路咖啡店", "2026-07-18 衡山路街角"],
    },
    {
      id: "role-city-cat",
      name: "巷口猫",
      avatar: "猫",
      personality: "神秘、慢热、喜欢讲故事",
      languageStyle: "像旁白一样提示线索，避免太直接",
      likes: "历史建筑、安静街巷、故事任务",
      dislikes: "吵闹场景、强互动要求",
      forbiddenBehaviors: "不得暗示用户跟随陌生人；不得制造恐慌",
      recommendedTaskTypes: ["story", "place_discovery"],
      currentArea: "上海武康路",
      appearancePlan: "18:00-20:30 出现，优先触发故事线任务",
      historyTrace: ["2026-07-03 武康路", "2026-07-16 安福路"],
    },
  ],
  locations: [
    {
      id: "loc-yongkang-cafe",
      name: "永康路咖啡角",
      region: "上海徐汇",
      type: "咖啡店",
      latitude: "31.21584",
      longitude: "121.45331",
      triggerRadiusMeters: 5,
      openHours: "10:00-22:00",
      status: "active",
    },
    {
      id: "loc-wukang-road",
      name: "武康路街区",
      region: "上海徐汇",
      type: "历史街区",
      latitude: "31.20910",
      longitude: "121.43841",
      triggerRadiusMeters: 8,
      openHours: "全天",
      status: "active",
    },
  ],
  rewards: [
    {
      id: "reward-white-gear",
      name: "新手白装 · 城市徽章",
      type: "white_gear",
      amount: 1,
      firstRewardProtected: true,
      description: "首次完成闪现任务必得，避免空奖励体验。",
    },
    {
      id: "reward-story",
      name: "城市故事记录",
      type: "story_record",
      amount: 1,
      firstRewardProtected: false,
      description: "写入用户个人故事线。",
    },
    {
      id: "reward-growth",
      name: "探索成长值",
      type: "growth_reward",
      amount: 20,
      firstRewardProtected: true,
      description: "固定成长奖励，用于新手引导和等级成长。",
    },
  ],
  equipmentPools: [
    {
      id: "pool-cafe",
      shopName: "永康路咖啡合作店",
      poolName: "咖啡街角装备池",
      equipment: [
        { id: "eq-pin", name: "城市别针", rarity: "normal", probability: 80, fragmentValue: 1, status: "active" },
        { id: "eq-card", name: "限定咖啡卡", rarity: "rare", probability: 20, fragmentValue: 6, status: "active" },
      ],
    },
  ],
  testLogs: [],
};

const emptyTask = (): FlashTask => ({
  id: createId("task"),
  name: "",
  brief: "",
  type: "city_exploration",
  aiRoleId: "role-yuezai",
  locationId: "loc-yongkang-cafe",
  completionCondition: "GPS 距离小于 5 米并点击完成打卡",
  rewardId: "reward-white-gear",
  startAt: "",
  endAt: "",
  status: "draft",
});

const emptyLocation = (): FlashLocation => ({
  id: createId("loc"),
  name: "",
  region: "",
  type: "城市地标",
  latitude: "",
  longitude: "",
  triggerRadiusMeters: 5,
  openHours: "10:00-22:00",
  status: "active",
});

function getBadgeClass(status: FlashTaskStatus | LocationStatus | ConsistencyStatus) {
  if (status === "running" || status === "active" || status === "pass") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "pending" || status === "suggest") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "forbid" || status === "paused") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function loadState(): FlashOpsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return seedState;
    return { ...seedState, ...JSON.parse(stored) };
  } catch {
    return seedState;
  }
}

function buildConsistencyResult(task: FlashTask | undefined, role: AiRole | undefined) {
  if (!task || !role) {
    return {
      status: "suggest" as ConsistencyStatus,
      summary: "请选择任务和 AI 角色后再检查一致性。",
      items: ["任务或角色缺失，无法判断风格、地点和奖励是否匹配。"],
    };
  }

  const issues: string[] = [];
  const suggestions: string[] = [];
  const forbiddenTokens = role.forbiddenBehaviors
    .split(/[，,；;、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!role.recommendedTaskTypes.includes(task.type)) {
    suggestions.push(`角色「${role.name}」不常用于「${taskTypeLabels[task.type]}」，建议换角色或调整模板。`);
  }

  if (forbiddenTokens.some((token) => task.brief.includes(token) || task.completionCondition.includes(token))) {
    issues.push("任务文案或完成条件命中了该角色的禁止行为。");
  }

  if (!task.rewardId) {
    suggestions.push("任务还没有绑定固定奖励，建议上线前补齐奖励配置。");
  }

  if (!task.locationId) {
    issues.push("任务缺少触发地点，无法保证真实位置触发。");
  }

  if (issues.length > 0) {
    return { status: "forbid" as ConsistencyStatus, summary: "不建议上线", items: issues.concat(suggestions) };
  }

  if (suggestions.length > 0) {
    return { status: "suggest" as ConsistencyStatus, summary: "可上线但建议调整", items: suggestions };
  }

  return {
    status: "pass" as ConsistencyStatus,
    summary: "一致性通过",
    items: ["角色语气、任务类型、地点触发和奖励配置都满足 V1 闪现任务上线要求。"],
  };
}

export default function AdminFlashOpsPage() {
  const [state, setState] = useState<FlashOpsState>(() => loadState());
  const [taskDraft, setTaskDraft] = useState<FlashTask>(() => emptyTask());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState<FlashLocation>(() => emptyLocation());
  const [selectedConsistencyTaskId, setSelectedConsistencyTaskId] = useState(seedState.tasks[0]?.id ?? "");
  const [selectedConsistencyRoleId, setSelectedConsistencyRoleId] = useState(seedState.roles[0]?.id ?? "");
  const [testLocation, setTestLocation] = useState("31.21584,121.45331");
  const [testTaskId, setTestTaskId] = useState(seedState.tasks[0]?.id ?? "");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const metrics = useMemo(() => {
    const runningTasks = state.tasks.filter((task) => task.status === "running").length;
    const readyTasks = state.tasks.filter((task) => task.status === "pending" || task.status === "running").length;
    const activeLocations = state.locations.filter((location) => location.status === "active").length;
    const activeEquipment = state.equipmentPools.flatMap((pool) => pool.equipment).filter((item) => item.status === "active").length;

    return {
      runningTasks,
      readyTasks,
      activeLocations,
      activeRoles: state.roles.length,
      activeEquipment,
      completionRate: state.tasks.length ? Math.round((runningTasks / state.tasks.length) * 100) : 0,
    };
  }, [state]);

  const consistencyResult = useMemo(
    () =>
      buildConsistencyResult(
        state.tasks.find((task) => task.id === selectedConsistencyTaskId),
        state.roles.find((role) => role.id === selectedConsistencyRoleId),
      ),
    [selectedConsistencyRoleId, selectedConsistencyTaskId, state.roles, state.tasks],
  );

  const selectedTask = state.tasks.find((task) => task.id === testTaskId);

  const saveTask = (statusOverride?: FlashTaskStatus) => {
    const nextTask = {
      ...taskDraft,
      status: statusOverride ?? taskDraft.status,
      name: taskDraft.name.trim() || "未命名闪现任务",
      brief: taskDraft.brief.trim() || "待补充任务简介",
    };

    setState((prev) => ({
      ...prev,
      tasks: editingTaskId
        ? prev.tasks.map((task) => (task.id === editingTaskId ? nextTask : task))
        : [nextTask, ...prev.tasks],
    }));
    setEditingTaskId(null);
    setTaskDraft(emptyTask());
  };

  const editTask = (task: FlashTask) => {
    setEditingTaskId(task.id);
    setTaskDraft(task);
  };

  const saveLocation = () => {
    const nextLocation = {
      ...locationDraft,
      name: locationDraft.name.trim() || "未命名地点",
      region: locationDraft.region.trim() || "待配置区域",
    };

    setState((prev) => ({
      ...prev,
      locations: [nextLocation, ...prev.locations],
    }));
    setLocationDraft(emptyLocation());
  };

  const addTestLog = (action: string, detail: string) => {
    setState((prev) => ({
      ...prev,
      testLogs: [
        {
          id: createId("test"),
          action,
          detail,
          timestamp: new Date().toLocaleString("zh-CN", { hour12: false }),
        },
        ...prev.testLogs.slice(0, 7),
      ],
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">闪现 V1.0</Badge>
            <Badge variant="outline">独立于盲盒装备系统</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">闪现运营中心</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            管理城市探索任务、AI 角色、地点触发、固定奖励、任务模板、一致性检查、测试工具和数据分析。
          </p>
        </div>
        <Button onClick={() => setTaskDraft(emptyTask())} data-testid="button-flash-new-task">
          <Plus className="mr-2 h-4 w-4" />
          新建闪现任务
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "进行中任务", value: metrics.runningTasks, icon: Zap },
          { label: "待上线/进行中", value: metrics.readyTasks, icon: Rocket },
          { label: "AI 角色", value: metrics.activeRoles, icon: Bot },
          { label: "有效地点", value: metrics.activeLocations, icon: MapPin },
          { label: "可用装备", value: metrics.activeEquipment, icon: PackageOpen },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="tasks">任务管理</TabsTrigger>
          <TabsTrigger value="templates">任务模板</TabsTrigger>
          <TabsTrigger value="roles">AI 角色</TabsTrigger>
          <TabsTrigger value="locations">地点管理</TabsTrigger>
          <TabsTrigger value="rewards">奖励/装备</TabsTrigger>
          <TabsTrigger value="consistency">一致性检查</TabsTrigger>
          <TabsTrigger value="testing">测试工具</TabsTrigger>
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Compass className="h-5 w-5" />
                  闪现任务列表
                </CardTitle>
                <CardDescription>支持草稿、待上线、进行中、已结束、归档全生命周期。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {state.tasks.map((task) => {
                  const role = state.roles.find((item) => item.id === task.aiRoleId);
                  const location = state.locations.find((item) => item.id === task.locationId);
                  const reward = state.rewards.find((item) => item.id === task.rewardId);

                  return (
                    <div key={task.id} className="rounded-lg border bg-background p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{task.name}</h3>
                            <Badge variant="outline" className={getBadgeClass(task.status)}>
                              {taskStatusLabels[task.status]}
                            </Badge>
                            <Badge variant="secondary">{taskTypeLabels[task.type]}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{task.brief}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>AI：{role?.name ?? "未选择"}</span>
                            <span>地点：{location?.name ?? "未选择"}</span>
                            <span>奖励：{reward?.name ?? "未选择"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editTask(task)}>
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                tasks: prev.tasks.map((item) =>
                                  item.id === task.id
                                    ? { ...item, status: item.status === "running" ? "ended" : "running" }
                                    : item,
                                ),
                              }))
                            }
                          >
                            {task.status === "running" ? "结束" : "上线"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{editingTaskId ? "编辑任务" : "新建任务"}</CardTitle>
                <CardDescription>按 PRD 字段配置任务名称、类型、角色、地点、条件、奖励和时间。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>任务名称</Label>
                  <Input value={taskDraft.name} onChange={(event) => setTaskDraft({ ...taskDraft, name: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>任务简介</Label>
                  <Textarea value={taskDraft.brief} onChange={(event) => setTaskDraft({ ...taskDraft, brief: event.target.value })} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>任务类型</Label>
                    <Select value={taskDraft.type} onValueChange={(value) => setTaskDraft({ ...taskDraft, type: value as FlashTaskType })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>任务状态</Label>
                    <Select value={taskDraft.status} onValueChange={(value) => setTaskDraft({ ...taskDraft, status: value as FlashTaskStatus })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>AI 角色</Label>
                    <Select value={taskDraft.aiRoleId} onValueChange={(value) => setTaskDraft({ ...taskDraft, aiRoleId: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {state.roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>触发地点</Label>
                    <Select value={taskDraft.locationId} onValueChange={(value) => setTaskDraft({ ...taskDraft, locationId: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {state.locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>完成条件</Label>
                  <Textarea value={taskDraft.completionCondition} onChange={(event) => setTaskDraft({ ...taskDraft, completionCondition: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>固定奖励</Label>
                  <Select value={taskDraft.rewardId} onValueChange={(value) => setTaskDraft({ ...taskDraft, rewardId: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {state.rewards.map((reward) => (
                        <SelectItem key={reward.id} value={reward.id}>
                          {reward.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>开始时间</Label>
                    <Input type="datetime-local" value={taskDraft.startAt} onChange={(event) => setTaskDraft({ ...taskDraft, startAt: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>结束时间</Label>
                    <Input type="datetime-local" value={taskDraft.endAt} onChange={(event) => setTaskDraft({ ...taskDraft, endAt: event.target.value })} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => saveTask()}>
                    <Save className="mr-2 h-4 w-4" />
                    保存
                  </Button>
                  <Button variant="outline" onClick={() => saveTask("running")}>
                    <Rocket className="mr-2 h-4 w-4" />
                    保存并上线
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="grid gap-4 lg:grid-cols-2">
          {state.templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  {template.name}
                  <Badge>{taskTypeLabels[template.type]}</Badge>
                </CardTitle>
                <CardDescription>{template.allowedObjectives}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <p className="font-medium">推荐地点类型</p>
                  <p className="text-muted-foreground">{template.recommendedLocationType}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="font-medium">推荐奖励</p>
                  <p className="text-muted-foreground">{rewardTypeLabels[template.recommendedRewardType]}</p>
                </div>
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>禁止内容</AlertTitle>
                  <AlertDescription>{template.forbiddenContent}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roles" className="grid gap-4 xl:grid-cols-2">
          {state.roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">{role.avatar}</span>
                  {role.name}
                </CardTitle>
                <CardDescription>{role.personality}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">语言风格</p>
                    <p className="text-sm text-muted-foreground">{role.languageStyle}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">当前出现区域</p>
                    <p className="text-sm text-muted-foreground">{role.currentArea}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">喜欢</p>
                    <p className="text-sm text-muted-foreground">{role.likes}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">不喜欢</p>
                    <p className="text-sm text-muted-foreground">{role.dislikes}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium">出现计划</p>
                  <p className="text-sm text-muted-foreground">{role.appearancePlan}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">推荐任务类型</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {role.recommendedTaskTypes.map((type) => (
                      <Badge key={type} variant="outline">
                        {taskTypeLabels[type]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Alert variant="destructive">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>禁止行为</AlertTitle>
                  <AlertDescription>{role.forbiddenBehaviors}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="locations" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                地点触发配置
              </CardTitle>
              <CardDescription>用于真实位置触发，支持 5m 级距离条件。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.locations.map((location) => (
                <div key={location.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{location.name}</h3>
                      <Badge variant="outline" className={getBadgeClass(location.status)}>
                        {location.status === "active" ? "启用" : location.status === "paused" ? "暂停" : "退役"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {location.region} · {location.type} · {location.latitude}, {location.longitude}
                    </p>
                    <p className="text-xs text-muted-foreground">触发半径 {location.triggerRadiusMeters}m · 开放时间 {location.openHours}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        locations: prev.locations.map((item) =>
                          item.id === location.id
                            ? { ...item, status: item.status === "active" ? "paused" : "active" }
                            : item,
                        ),
                      }))
                    }
                  >
                    {location.status === "active" ? "暂停" : "启用"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">新增地点</CardTitle>
              <CardDescription>保存区域、经纬度、触发半径和开放时间。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="地点名称" value={locationDraft.name} onChange={(event) => setLocationDraft({ ...locationDraft, name: event.target.value })} />
              <Input placeholder="区域" value={locationDraft.region} onChange={(event) => setLocationDraft({ ...locationDraft, region: event.target.value })} />
              <Input placeholder="地点类型" value={locationDraft.type} onChange={(event) => setLocationDraft({ ...locationDraft, type: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="纬度" value={locationDraft.latitude} onChange={(event) => setLocationDraft({ ...locationDraft, latitude: event.target.value })} />
                <Input placeholder="经度" value={locationDraft.longitude} onChange={(event) => setLocationDraft({ ...locationDraft, longitude: event.target.value })} />
              </div>
              <Input
                type="number"
                min={1}
                value={locationDraft.triggerRadiusMeters}
                onChange={(event) => setLocationDraft({ ...locationDraft, triggerRadiusMeters: Number(event.target.value) })}
              />
              <Input placeholder="开放时间" value={locationDraft.openHours} onChange={(event) => setLocationDraft({ ...locationDraft, openHours: event.target.value })} />
              <Button onClick={saveLocation} fullWidth>
                <Plus className="mr-2 h-4 w-4" />
                保存地点
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5" />
                闪现固定奖励
              </CardTitle>
              <CardDescription>覆盖固定白装、故事记录、趋势值、成长奖励和首次奖励保护。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.rewards.map((reward) => (
                <div key={reward.id} className="rounded-lg border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{reward.name}</h3>
                      <p className="text-sm text-muted-foreground">{reward.description}</p>
                    </div>
                    <Badge variant="secondary">{rewardTypeLabels[reward.type]}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm">数量/数值：{reward.amount}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span>首次保护</span>
                      <Switch
                        checked={reward.firstRewardProtected}
                        onCheckedChange={(checked) =>
                          setState((prev) => ({
                            ...prev,
                            rewards: prev.rewards.map((item) =>
                              item.id === reward.id ? { ...item, firstRewardProtected: checked } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5" />
                盲盒店铺装备池
              </CardTitle>
              <CardDescription>店铺独立商业模块，普通 80%、稀有 20%，重复转碎片。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.equipmentPools.map((pool) => (
                <div key={pool.id} className="rounded-lg border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{pool.poolName}</h3>
                      <p className="text-sm text-muted-foreground">{pool.shopName}</p>
                    </div>
                    <Badge variant="outline">商户装备库</Badge>
                  </div>
                  <div className="space-y-2">
                    {pool.equipment.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.rarity === "normal" ? "普通" : "稀有"} · {item.probability}% · {item.fragmentValue} 碎片
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consistency" className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5" />
                检查输入
              </CardTitle>
              <CardDescription>任务创建后选择 AI 角色，先做一致性检查再上线。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>任务</Label>
                <Select value={selectedConsistencyTaskId} onValueChange={setSelectedConsistencyTaskId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AI 角色</Label>
                <Select value={selectedConsistencyRoleId} onValueChange={setSelectedConsistencyRoleId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button fullWidth>
                <Search className="mr-2 h-4 w-4" />
                重新检查
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5" />
                AI 一致性结果
              </CardTitle>
              <CardDescription>返回通过、建议修改或禁止上线。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="outline" className={getBadgeClass(consistencyResult.status)}>
                {consistencyResult.status === "pass" ? "通过" : consistencyResult.status === "suggest" ? "建议修改" : "禁止上线"}
              </Badge>
              <h3 className="text-xl font-semibold">{consistencyResult.summary}</h3>
              <div className="space-y-2">
                {consistencyResult.items.map((item) => (
                  <div key={item} className="flex gap-2 rounded-md bg-muted p-3 text-sm">
                    {consistencyResult.status === "pass" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5" />
                闪现测试工具
              </CardTitle>
              <CardDescription>模拟用户位置、快速到达、强制完成和发放固定奖励。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>模拟位置</Label>
                <Input value={testLocation} onChange={(event) => setTestLocation(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>测试任务</Label>
                <Select value={testTaskId} onValueChange={setTestTaskId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => addTestLog("模拟到达", `用户位置 ${testLocation} 到达 ${selectedTask?.name ?? "任务地点"}`)}>
                  <MapPin className="mr-2 h-4 w-4" />
                  快速到达任务地点
                </Button>
                <Button variant="outline" onClick={() => addTestLog("强制完成", `已强制完成 ${selectedTask?.name ?? "当前任务"}`)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  强制完成任务
                </Button>
                <Button onClick={() => addTestLog("发放奖励", `已发放 ${selectedTask?.rewardId ?? "固定奖励"}`)}>
                  <Gift className="mr-2 h-4 w-4" />
                  发放固定奖励
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlayCircle className="h-5 w-5" />
                测试记录
              </CardTitle>
              <CardDescription>用于 QA 回归记录任务状态和奖励结果。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.testLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  还没有测试记录，先在左侧执行一次测试动作。
                </div>
              ) : (
                state.testLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{log.detail}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "闪现接受率", value: "62%", icon: Activity },
              { label: "闪现完成率", value: `${metrics.completionRate}%`, icon: CheckCircle2 },
              { label: "热门地点", value: state.locations[0]?.name ?? "暂无", icon: MapPin },
              { label: "盲盒转化", value: "18%", icon: Store },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                运营指标
              </CardTitle>
              <CardDescription>V1 包含闪现任务、地点、路径和盲盒装备数据。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4 rounded-lg border bg-background p-4">
                <h3 className="font-semibold">探索路径</h3>
                {state.locations.map((location, index) => (
                  <div key={location.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{index + 1}. {location.name}</span>
                      <span className="text-muted-foreground">{Math.max(12, 84 - index * 18)}%</span>
                    </div>
                    <Progress value={Math.max(12, 84 - index * 18)} />
                  </div>
                ))}
              </div>
              <div className="space-y-4 rounded-lg border bg-background p-4">
                <h3 className="font-semibold">装备抽取数据</h3>
                {state.equipmentPools.flatMap((pool) => pool.equipment).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">概率 {item.probability}% · 碎片 {item.fragmentValue}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>数据口径</AlertTitle>
            <AlertDescription>
              闪现任务接受率、完成率、热门地点、探索路径、盲盒转化、装备热度和碎片兑换应由后端埋点持续回填；当前页面已提供 V1 管理和验收入口。
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
