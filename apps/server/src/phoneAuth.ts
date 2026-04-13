import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { sanitizeAuthUser } from "./auth/sanitizeAuthUser";
import { isDebugAuthLoggingEnabled, isDevAuthToolsEnabled } from "./auth/policy";

// 简化的验证码存储（生产环境应使用Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 🎯 DEMO MODE: 万能验证码，方便演示（仅非生产环境启用）
const DEMO_CODE = process.env.NODE_ENV !== 'production' ? "666666" : null;

// 生成6位数验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


export function validateVerificationCode(phoneNumber: string, code: string) {
  if (!phoneNumber || !code) {
    return { ok: false, message: 'Phone number and code are required' };
  }
  if (DEMO_CODE && code === DEMO_CODE) {
    return { ok: true, demo: true };
  }
  const storedData = verificationCodes.get(phoneNumber);
  if (!storedData) {
    return { ok: false, message: '验证码无效或已过期' };
  }
  if (storedData.expiresAt < Date.now()) {
    verificationCodes.delete(phoneNumber);
    return { ok: false, message: '验证码已过期' };
  }
  if (storedData.code !== code) {
    return { ok: false, message: '验证码错误' };
  }
  verificationCodes.delete(phoneNumber);
  return { ok: true };
}
export function setupPhoneAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === 'production';
  const debugAuthLoggingEnabled = isDebugAuthLoggingEnabled();

  // ============ Phase 2: Debug Endpoints (无依赖测试) ============
  // Explicitly opt-in only; these routes are not registered in production by default.
  if (isDevAuthToolsEnabled()) {
  // A) 强制 set 普通 cookie（验证链路是否吞 Set-Cookie）
  app.get("/api/debug/cookie-direct", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/cookie-direct called");
    res.cookie("debug_direct", "1", { 
      path: "/", 
      secure: isProduction, 
      sameSite: isProduction ? "none" : "lax" 
    });
    res.json({ ok: true, message: "Check for Set-Cookie: debug_direct=1" });
  });

  // B) 强制写 session 并保存（验证 session cookie 能否发出）
  app.get("/api/debug/session-set", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/session-set called, sessionID:", req.sessionID);
    req.session.userId = "debug-user";
    req.session.isAdmin = true;
    req.session.save((err) => {
      if (err) {
        console.error("🔧 [DEBUG] Session save error:", err);
        return res.status(500).json({ ok: false, err: String(err) });
      }
      console.log("🔧 [DEBUG] Session saved, sid:", req.sessionID);
      res.json({ ok: true, sid: req.sessionID });
    });
  });

  // C) 回显 cookie（验证浏览器是否带回 cookie）
  app.get("/api/debug/echo-cookie", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/echo-cookie called");
    res.json({
      cookieHeader: req.headers.cookie || null,
      sessionID: req.sessionID || null,
      sessionUserId: req.session?.userId || null,
      sessionIsAdmin: req.session?.isAdmin || null,
      // 🔧 关键诊断字段 - 检查 HTTPS/proxy 识别
      reqSecure: req.secure,
      xForwardedProto: req.headers['x-forwarded-proto'] || null,
      protocol: req.protocol,
      // 🔧 额外诊断 - 定位是哪层出问题
      xForwardedHost: req.headers['x-forwarded-host'] || null,
      xForwardedFor: req.headers['x-forwarded-for'] || null,
      host: req.headers.host || null,
    });
  });

  // 兼容旧的 set-cookie 端点
  app.get("/api/debug/set-cookie", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/set-cookie called");
    res.cookie("debug_direct", "1", {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: "/",
    });
    req.session.debugTest = Date.now();
    req.session.save((err) => {
      if (err) {
        console.error("🔧 [DEBUG] Session save error:", err);
        return res.status(500).json({ ok: false, error: String(err) });
      }
      console.log("🔧 [DEBUG] Session saved successfully, sessionID:", req.sessionID);
      res.json({ ok: true, sessionID: req.sessionID, message: "Check Response Headers for Set-Cookie" });
    });
  });

  }

  // 发送验证码
  app.post("/api/auth/send-code", async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber || !/^1\d{10}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Invalid phone number" });
      }

      const code = generateCode();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟过期

      verificationCodes.set(phoneNumber, { code, expiresAt });

      // 仅在非生产环境输出验证码，避免敏感信息进入生产日志。
      if (!isProduction) {
        console.log(`📱 Verification code for ${phoneNumber}: ${code}`);
      }

      // 生产环境中，这里应该调用短信服务商API发送验证码
      // 例如：await sendSMS(phoneNumber, `您的验证码是：${code}，5分钟内有效`);

      res.json({ message: "Verification code sent successfully" });
    } catch (error) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // 手机号登录
  app.post("/api/auth/phone-login", async (req, res) => {
    try {
      const { phoneNumber, code, referralCode } = req.body;

      if (!phoneNumber || !code) {
        return res.status(400).json({ message: "Phone number and code are required" });
      }

      const verification = validateVerificationCode(phoneNumber, code);
      if (!verification.ok) {
        return res.status(400).json({ message: verification.message });
      }

      // 查找或创建用户
      const users = await storage.getUserByPhone(phoneNumber);
      let userId: string;
      let isNewUser = false;

      if (users.length > 0) {
        // 用户已存在
        userId = users[0].id;
      } else {
        // 创建新用户（手机号作为临时标识）
        const newUser = await storage.createUserWithPhone({
          phoneNumber,
          email: `${phoneNumber}@temp.joyjoin.com`, // 临时邮箱
          firstName: "用户",
          lastName: phoneNumber.slice(-4), // 使用手机号后4位
        });
        userId = newUser.id;
        isNewUser = true;
        
        // 🎯 DEMO MODE: 为新用户创建演示数据（仅非生产环境）
        // 如果使用的是演示验证码666666，只创建基础账号让用户测试注册流程
        // 否则创建完整演示数据
        // Note: DEMO_CODE is null in production, so isUsingDemoCode is always false there.
        // The NODE_ENV guard is still required to prevent createDemoDataForUser from running
        // in production (isUsingDemoCode being false does NOT skip the call).
        const isUsingDemoCode = DEMO_CODE !== null && code === DEMO_CODE;
        if (process.env.NODE_ENV !== 'production' && !isUsingDemoCode) {
          await createDemoDataForUser(userId);
        }
      }
      
      // Process referral code only for new users
      if (isNewUser && referralCode) {
        await processReferralConversion(userId, referralCode);
      }

      // 设置session - Phase 4.1 DEBUG_AUTH logging
      if (debugAuthLoggingEnabled) {
        console.log("[LOGIN] before", { sid: req.sessionID, cookie: req.headers.cookie });
      }
      
      // 直接写入 session（不用 regenerate，更简单可靠）
      req.session.userId = userId;
      req.session.verifiedPhoneNumber = phoneNumber;
      
      if (debugAuthLoggingEnabled) {
        console.log("[LOGIN] session written", { userId, sessionData: req.session });
      }
      
      // 使用 Promise 包装 save，确保完成后再响应
      req.session.save(async (err) => {
        if (debugAuthLoggingEnabled) {
          console.log("[LOGIN] after-save", {
            err: err ? String(err) : null,
            sid: req.sessionID,
            setCookie: res.getHeader("set-cookie") || null,
          });
        }
        
        if (err) {
          console.error("🔐 [LOGIN] Session save error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        console.log("🔐 [LOGIN] Session saved successfully! sessionID:", req.sessionID);
        
        // 获取完整的用户数据并返回
        try {
          const user = await storage.getUserById(userId);
          console.log("🔐 [LOGIN] Sending response for user:", user?.id, "isAdmin:", user?.isAdmin);
          const safeUser = user ? sanitizeAuthUser(user as Record<string, unknown>) : {};
          res.json({ 
            message: "Login successful",
            userId,
            ...safeUser
          });
        } catch (err) {
          console.error("🔐 [LOGIN] Get user error:", err);
          res.status(500).json({ message: "Login failed" });
        }
      });
    } catch (error) {
      console.error("Error during phone login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // 登出
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });
}

// 认证中间件
export const isPhoneAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// 🎯 DEMO MODE: 为新用户创建完整的演示数据
async function createDemoDataForUser(userId: string) {
  try {
    const { db } = await import("./db");
    const { users, roleResults, blindBoxEvents } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    console.log(`🎯 Creating demo data for user: ${userId}`);
    
    // 1. 设置用户为已完成所有 onboarding 步骤，并添加背景信息
    await db.update(users)
      .set({
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true,
        hasCompletedPersonalityTest: true,
        hasCompletedProfileSetup: true,
        hasCompletedVoiceQuiz: true,
        // 添加背景信息以触发Epic契合点
        educationLevel: 'Master\'s',
        seniority: 'Founder',
        industry: '科技',
        interestsTop: ['摄影', '写作', '创业', '可持续发展', '咖啡'],
      })
      .where(eq(users.id, userId));
    
    // 2. 创建演示性格测试结果
    await db.insert(roleResults).values({
      userId,
      primaryArchetype: '连接者',
      primaryArchetypeScore: 18,
      secondaryArchetype: '探索者',
      secondaryArchetypeScore: 15,
      roleSubtype: 'balanced',
      roleScores: {
        '连接者': 18,
        '探索者': 15,
        '火花塞': 12,
        '氛围组': 10,
        '故事家': 9,
        '社交达人': 8,
        '创意家': 6,
        '守护者': 4
      },
      affinityScore: 8,
      opennessScore: 9,
      conscientiousnessScore: 7,
      emotionalStabilityScore: 8,
      extraversionScore: 7,
      positivityScore: 9,
      strengths: '你天生善于连接不同背景的人，总能找到大家的共同话题。你的亲和力让人感到舒适，愿意向你敞开心扉。',
      challenges: '有时可能因为太在意他人感受而忽略自己的需求，需要学会适当表达自己的观点。',
      idealFriendTypes: ['探索者', '故事家', '创意家'],
      testVersion: 1,
    });
    
    // 3. 更新用户的 archetype 字段
    await db.update(users)
      .set({
        primaryArchetype: '连接者',
        secondaryArchetype: '探索者',
        archetype: '连接者',
      })
      .where(eq(users.id, userId));
    
    // 4. 创建已匹配活动（明天晚上的日料聚餐）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    
    await db.insert(blindBoxEvents).values({
      userId,
      title: '周四 19:00 · 饭局',
      eventType: '饭局',
      city: '香港',
      district: '中环',
      dateTime: tomorrow,
      budgetTier: '150-250',
      selectedLanguages: ['粤语', '普通话'],
      selectedCuisines: ['日本料理', '粤菜'],
      acceptNearby: true,
      status: 'matched',
      progress: 100,
      currentParticipants: 5,
      totalParticipants: 5,
      maleCount: 2,
      femaleCount: 3,
      restaurantName: '鮨一 Sushi Ichi',
      restaurantAddress: '中环云咸街28号',
      cuisineTags: ['日本料理', '寿司'],
      matchedAttendees: [
        { 
          userId: 'demo-epic-1', 
          displayName: 'Sophia', 
          archetype: '探索者', 
          topInterests: ['摄影', '音乐创作', '可持续发展'], 
          age: 30,
          birthdate: '1995-03-15',
          gender: 'Woman',
          hometownRegionCity: '上海',
          industry: '设计',
          educationLevel: 'Master\'s',
          studyLocale: 'Overseas',
          fieldOfStudy: '艺术设计',
          seniority: 'Senior',
          relationshipStatus: 'Single',
          languagesComfort: ['普通话', '英语', '日语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-epic-2', 
          displayName: 'Max', 
          archetype: '火花塞', 
          topInterests: ['创业', '公益', '写作'], 
          age: 32,
          birthdate: '1993-06-20',
          gender: 'Man',
          hometownRegionCity: '北京',
          industry: '社会创新',
          educationLevel: 'Master\'s',
          studyLocale: 'Both',
          fieldOfStudy: '商业管理',
          seniority: 'Founder',
          relationshipStatus: 'Single',
          languagesComfort: ['普通话', '英语', '法语', '西班牙语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-epic-3', 
          displayName: '艾米', 
          archetype: '连接者', 
          topInterests: ['绘画', '摄影', '数字游民'], 
          age: 28,
          birthdate: '1997-08-10',
          gender: 'Woman',
          hometownRegionCity: '广州',
          industry: '设计',
          educationLevel: 'Bachelor\'s',
          studyLocale: 'Overseas',
          fieldOfStudy: '视觉设计',
          seniority: 'Mid',
          relationshipStatus: 'Single',
          languagesComfort: ['普通话', '英语', '粤语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-epic-4', 
          displayName: 'Leo', 
          archetype: '创意家', 
          topInterests: ['音乐创作', '可持续', '咖啡'], 
          age: 31,
          birthdate: '1994-11-25',
          gender: 'Man',
          hometownRegionCity: '深圳',
          industry: '科技',
          educationLevel: 'Doctorate',
          studyLocale: 'Overseas',
          fieldOfStudy: '计算机科学',
          seniority: 'Founder',
          relationshipStatus: 'Married/Partnered',
          languagesComfort: ['普通话', '英语', '德语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        }
      ],
      matchExplanation: '这桌是日料爱好者的聚会！大家都对精致料理和文化交流充满热情，年龄相近，话题契合度高。',
    });
    
    // 5. 创建已完成活动（上周的精酿啤酒聚会）
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(20, 0, 0, 0);
    
    await db.insert(blindBoxEvents).values({
      userId,
      title: '周三 20:00 · 酒局',
      eventType: '酒局',
      city: '深圳',
      district: '南山区',
      dateTime: lastWeek,
      budgetTier: '200-300',
      selectedLanguages: ['普通话', '英语'],
      selectedCuisines: ['西餐', '酒吧'],
      acceptNearby: false,
      status: 'completed',
      progress: 100,
      currentParticipants: 6,
      totalParticipants: 6,
      maleCount: 3,
      femaleCount: 3,
      restaurantName: 'The Tap House 精酿酒吧',
      restaurantAddress: '南山区海德三道1186号',
      cuisineTags: ['酒吧', '西餐'],
      matchedAttendees: [
        { 
          userId: 'demo-5', 
          displayName: 'Sarah', 
          archetype: '氛围组', 
          topInterests: ['音乐', '社交', '美食'], 
          age: 29, 
          birthdate: '1996-04-12', 
          gender: 'Woman',
          industry: '创业',
          educationLevel: 'Bachelor\'s',
          studyLocale: 'Overseas',
          fieldOfStudy: '市场营销',
          seniority: 'Founder',
          relationshipStatus: 'Single',
          hometownRegionCity: '深圳',
          languagesComfort: ['普通话', '英语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-6', 
          displayName: 'Alex', 
          archetype: '火花塞', 
          topInterests: ['创业', '科技', '阅读'], 
          age: 31, 
          birthdate: '1994-09-08', 
          gender: 'Man',
          industry: '互联网',
          educationLevel: 'Master\'s',
          studyLocale: 'Both',
          fieldOfStudy: '软件工程',
          seniority: 'Senior',
          relationshipStatus: 'Single',
          hometownRegionCity: '杭州',
          languagesComfort: ['普通话', '英语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-7', 
          displayName: '小红', 
          archetype: '故事家', 
          topInterests: ['旅行', '摄影', '美食'], 
          age: 28, 
          birthdate: '1997-02-18', 
          gender: 'Woman',
          industry: '市场',
          educationLevel: 'Bachelor\'s',
          studyLocale: 'Domestic',
          fieldOfStudy: '市场营销',
          seniority: 'Mid',
          relationshipStatus: 'Single',
          hometownRegionCity: '成都',
          languagesComfort: ['普通话'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-8', 
          displayName: 'Tom', 
          archetype: '探索者', 
          topInterests: ['音乐', '电影', '旅行'], 
          age: 30, 
          birthdate: '1995-07-22', 
          gender: 'Man',
          industry: '设计',
          educationLevel: 'Bachelor\'s',
          studyLocale: 'Overseas',
          fieldOfStudy: '视觉设计',
          seniority: 'Mid',
          relationshipStatus: 'Married/Partnered',
          hometownRegionCity: '香港',
          languagesComfort: ['英语', '粤语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        },
        { 
          userId: 'demo-9', 
          displayName: 'Emma', 
          archetype: '连接者', 
          topInterests: ['艺术', '文化', '咖啡'], 
          age: 27, 
          birthdate: '1998-01-30', 
          gender: 'Woman',
          industry: '咨询',
          educationLevel: 'Master\'s',
          studyLocale: 'Both',
          fieldOfStudy: '管理咨询',
          seniority: 'Junior',
          relationshipStatus: 'Single',
          hometownRegionCity: '上海',
          languagesComfort: ['普通话', '英语'],
          ageVisible: true,
          educationVisible: true,
          industryVisible: true
        }
      ],
      matchExplanation: '这是一场创意人的深夜聚会！精酿啤酒配上有趣的灵魂，大家都喜欢分享故事和创意想法。',
    });
    
    console.log('✅ Demo data created successfully for user:', userId);
  } catch (error) {
    console.error('❌ Failed to create demo data:', error);
  }
}

// Process referral conversion when a new user registers via referral link
async function processReferralConversion(newUserId: string, referralCode: string) {
  try {
    const { db } = await import("./db");
    const { referralCodes, referralConversions } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");
    
    console.log(`🎁 Processing referral conversion for new user ${newUserId} with code ${referralCode}`);
    
    // Find the referral code
    const [referral] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, referralCode))
      .limit(1);
    
    if (!referral) {
      console.warn(`⚠️ Referral code not found: ${referralCode}`);
      return;
    }
    
    // Check if this user has already been counted for this referral code
    const [existingConversion] = await db
      .select()
      .from(referralConversions)
      .where(eq(referralConversions.invitedUserId, newUserId))
      .limit(1);
    
    if (existingConversion) {
      console.log(`ℹ️ User ${newUserId} already has a referral conversion record`);
      return;
    }
    
    // Create the referral conversion record
    await db.insert(referralConversions).values({
      referralCodeId: referral.id,
      invitedUserId: newUserId,
      inviterRewardIssued: false,
      inviteeRewardIssued: false,
    });
    
    // Update the referral code statistics
    await db.update(referralCodes)
      .set({ totalConversions: sql`${referralCodes.totalConversions} + 1` })
      .where(eq(referralCodes.id, referral.id));
    
    console.log(`✅ Referral conversion recorded: ${referralCode} -> ${newUserId}`);
  } catch (error) {
    console.error('❌ Failed to process referral conversion:', error);
  }
}
