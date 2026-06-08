#!/usr/bin/env node
import { db } from "../db";
import { users, eventPools } from "@joyjoin/shared";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

const ARCHETYPES = [
  "开心柯基", "太阳鸡", "夸夸仓鼠", "寻宝狐",
  "机灵海豚", "人脉蛛", "树洞考拉", "脑洞章鱼",
  "好奇猫头鹰", "靠谱大象", "慢热龟", "小透明猫",
];

const CITIES = ["深圳", "香港", "广州", "东莞", "北京", "上海", "杭州"];
const DISTRICTS: Record<string, string[]> = {
  "深圳": ["南山区", "福田区", "罗湖区", "宝安区", "龙岗区"],
  "香港": ["中西区", "湾仔区", "东区", "九龙城区", "观塘区"],
  "广州": ["天河区", "越秀区", "海珠区", "白云区", "番禺区"],
  "东莞": ["南城区", "东城区", "虎门镇", "长安镇"],
  "北京": ["朝阳区", "海淀区", "东城区", "西城区"],
  "上海": ["浦东新区", "黄浦区", "徐汇区", "静安区"],
  "杭州": ["西湖区", "上城区", "拱墅区", "滨江区"],
};
const GENDERS = ["女性", "男性", "不透露"];
const EVENT_TYPES = ["饭局", "咖啡", "桌游", "户外", "艺术", "运动", "KTV", "品酒"];
const INTENTS = ["networking", "friends", "discussion", "fun", "romance", "flexible"];

const COMMON_PASSWORD = "test123456";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomPhone(index: number): string {
  return `+861380010${String(index).padStart(4, "0")}`;
}

function randomName(index: number): string {
  const surnames = ["张", "李", "王", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "马", "朱", "胡", "林", "郭", "何", "高", "罗"];
  const givenNames = ["明", "华", "丽", "强", "静", "磊", "芳", "勇", "敏", "涛", "洋", "娜", "超", "霞", "浩", "雪", "晨", "宇", "欣", "杰"];
  return `${pick(surnames)}${pick(givenNames)}`;
}

function randomBirthdate(): string {
  const year = 1985 + Math.floor(Math.random() * 20);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function randomFutureDate(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1 + Math.floor(Math.random() * daysAhead));
  return d;
}

export interface MockUserOptions {
  phoneIndex: number;
  hasPassword?: boolean;
  hasProfile?: boolean;
  hasArchetype?: boolean;
  hasPersonality?: boolean;
}

export function generateMockUser(options: MockUserOptions) {
  const phoneNumber = randomPhone(options.phoneIndex);
  const displayName = randomName(options.phoneIndex);

  return {
    phoneNumber,
    displayName,
    password: options.hasPassword !== false ? COMMON_PASSWORD : undefined,
    gender: pick(GENDERS),
    currentCity: pick(CITIES),
    primaryArchetype: options.hasArchetype !== false ? pick(ARCHETYPES) : null,
    birthdate: randomBirthdate(),
    hasCompletedProfileSetup: options.hasProfile !== false,
    hasCompletedPersonalityTest: options.hasPersonality !== false,
    hasCompletedRegistration: true,
  };
}

export async function createMockUsers(count: number): Promise<{ id: string; phoneNumber: string; displayName: string }[]> {
  const passwordHash = await bcrypt.hash(COMMON_PASSWORD, 10);
  const results: { id: string; phoneNumber: string; displayName: string }[] = [];

  for (let i = 0; i < count; i++) {
    const phoneNumber = randomPhone(i);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber))
      .limit(1);

    if (existing.length > 0) {
      results.push({ id: existing[0].id, phoneNumber, displayName: "exists" });
      continue;
    }

    const mock = generateMockUser({
      phoneIndex: i,
      hasPassword: true,
      hasProfile: i > count * 0.2,
      hasArchetype: i > count * 0.1,
      hasPersonality: i > count * 0.15,
    });

    const [inserted] = await db
      .insert(users)
      .values({
        phoneNumber: mock.phoneNumber,
        displayName: mock.displayName,
        password: passwordHash,
        gender: mock.gender,
        currentCity: mock.currentCity,
        primaryArchetype: mock.primaryArchetype,
        birthdate: mock.birthdate,
        hasCompletedProfileSetup: mock.hasCompletedProfileSetup,
        hasCompletedPersonalityTest: mock.hasCompletedPersonalityTest,
        hasCompletedRegistration: true,
      })
      .returning({ id: users.id, phoneNumber: users.phoneNumber, displayName: users.displayName });

    results.push(inserted);
  }

  return results;
}

export async function createMockEventPool(createdBy: string, index: number) {
  const city = pick(CITIES);

  const [pool] = await db
    .insert(eventPools)
    .values({
      title: `模拟活动 #${index + 1} — ${pick(EVENT_TYPES)}`,
      description: `这是由数据生成器创建的第 ${index + 1} 个模拟活动。`,
      eventType: pick(EVENT_TYPES),
      city,
      district: pick(DISTRICTS[city] ?? DISTRICTS["深圳"]),
      dateTime: randomFutureDate(30),
      registrationDeadline: randomFutureDate(14),
      status: "active",
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: Math.floor(Math.random() * 3) + 1,
      createdBy,
    })
    .returning();

  return pool;
}

async function main() {
  const args = process.argv.slice(2);
  const userCount = parseInt(args[0] || "20", 10);
  const poolCount = parseInt(args[1] || "3", 10);

  console.log(`[mock] Generating ${userCount} mock users and ${poolCount} event pools...\n`);

  console.log("[mock] Creating users...");
  const mockUsers = await createMockUsers(userCount);
  const created = mockUsers.filter((u) => u.displayName !== "exists");
  console.log(`  Created: ${created.length}, Skipped: ${mockUsers.length - created.length}`);

  if (created.length > 0 && poolCount > 0) {
    console.log("\n[mock] Creating event pools...");
    const firstUserId = created[0].id;
    const pools = await Promise.all(
      Array.from({ length: poolCount }, (_, i) => createMockEventPool(firstUserId, i))
    );
    console.log(`  Created: ${pools.length} event pools`);
  }

  console.log(`\n[mock] Done. Common password: ${COMMON_PASSWORD}`);
  process.exit(0);
}

if (process.argv[1]?.includes("generate-mock-data")) {
  main().catch((err) => {
    console.error("[mock] Failed:", err);
    process.exit(1);
  });
}
