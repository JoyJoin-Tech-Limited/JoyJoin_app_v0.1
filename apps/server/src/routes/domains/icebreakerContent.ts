import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "../../phoneAuth";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { aiEndpointLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";

export function registerIcebreakerContentRoutes(app: Express): void {


  // Icebreaker routes - Multi-layered questions for deeper connection
  const icebreakerQuestions = {
    // Layer 1: Simple & Lighthearted - Easy entry points
    lighthearted: [
      "今天什么事让你微笑了？",
      "本周最好的消息是什么？",
      "最近吃过最奇怪的一道菜是什么？",
      "如果可以从日常生活中去掉一件事，你会选什么？为什么？",
      "如果能立刻学会一项技能，你想学什么？",
      "周末最喜欢做的一件小事是什么？",
      "最近什么事让你觉得很治愈？",
      "你的「快乐按钮」是什么？做什么事能让你立刻开心起来？",
    ],
    
    // Layer 2: Passions & Hobbies - Discovering interests
    passions: [
      "你对什么充满热情？为什么？",
      "有什么爱好或活动是你真正享受的？它吸引你的地方是什么？",
      "最近沉迷的一项运动或爱好是什么？",
      "有什么一直想尝试但还没开始的事情？",
      "如果有一整天自由时间，你会怎么度过？",
      "你会推荐别人尝试什么爱好或体验？",
      "什么事情会让你完全忘记时间？",
    ],
    
    // Layer 3: Travel & Adventures - Shared experiences
    travel: [
      "最难忘的一次旅行经历是什么？",
      "如果可以立刻去任何地方旅行，你会去哪里？",
      "旅行中遇到过什么意外的惊喜？",
      "你更喜欢计划好的行程，还是随性探索？",
      "有什么地方去了之后改变了你的想法？",
      "推荐一个你觉得被低估的旅行目的地",
      "下一个最想去的地方是哪里？为什么？",
    ],
    
    // Layer 4: Art & Creativity - Cultural connections
    creativity: [
      "最近有什么艺术作品或表演让你印象深刻？",
      "你会用什么方式表达创意？（音乐、绘画、写作等）",
      "有没有特别喜欢的艺术家或创作者？",
      "如果可以掌握一门艺术，你会选什么？",
      "最近在读什么书或在看什么剧？",
      "有什么电影或音乐改变了你的看法？",
      "你觉得什么样的创作最能打动人心？",
    ],
    
    // Layer 5: Innovation & Technology - Future thinking
    innovation: [
      "你觉得什么技术会改变我们的未来？",
      "有什么新科技产品让你觉得很酷？",
      "如果能发明一样东西解决生活中的问题，你会发明什么？",
      "你对AI有什么看法？它会如何影响我们的生活？",
      "最让你期待的未来趋势是什么？",
      "科技让生活更好了，还是更复杂了？",
    ],
    
    // Layer 6: Deeper Personal - Building trust
    personal: [
      "今晚你对这次聚会有什么期待？",
      "猜猜看，大家都是做什么工作的？",
      "如果明年要实现一个重要目标，会是什么？为什么？",
      "有什么经历塑造了现在的你？",
      "如果要教一门课，你会教什么？",
      "你觉得自己在哪方面成长了很多？",
      "最近学到的最重要的一课是什么？",
      "如果可以给5年前的自己一个建议，会说什么？",
    ],
    
    // Layer 7: Values & Beliefs - Deep connection
    values: [
      "有什么信念或价值观对你很重要？它如何影响你的选择？",
      "你觉得人类的发展方向是在进步还是倒退？为什么？",
      "什么样的事情会让你觉得很有意义？",
      "你觉得什么品质在人身上最可贵？",
      "有什么原则是你一直坚持的？",
      "你希望为这个世界留下什么？",
      "对你来说，成功意味着什么？",
    ],
    
    // Context-specific: Dining & Local
    dining: [
      "今天最想点的一道菜是什么？",
      "有什么特别的饮食偏好或禁忌吗？",
      "分享一个你难忘的用餐体验",
      "最近发现的好吃的店铺",
      "如果只能选一种菜系吃一辈子，会选什么？",
    ],
    
    city_life: [
      "在这座城市最爱的一个小店是哪里？",
      "推荐一个你觉得被低估的城市角落",
      "你最喜欢这个城市的哪个季节？",
      "如果要带朋友游览，会带去哪里？",
      "这个城市让你最惊喜的发现是什么？",
    ],
  };

  // Category labels for UI display
  const categoryLabels: Record<string, { name: string, color: string }> = {
    lighthearted: { name: "轻松愉快", color: "green" },
    passions: { name: "兴趣爱好", color: "blue" },
    travel: { name: "旅行探险", color: "purple" },
    creativity: { name: "艺术创意", color: "pink" },
    innovation: { name: "创新科技", color: "cyan" },
    personal: { name: "个人成长", color: "orange" },
    values: { name: "共同价值观", color: "red" },
    dining: { name: "美食话题", color: "yellow" },
    city_life: { name: "城市生活", color: "teal" },
  };

  app.get('/api/icebreakers/random', requireAuth, async (req: any, res) => {
    try {
      const { topic } = req.query;
      let selectedCategory: string;
      let questions: string[];
      
      if (topic && topic in icebreakerQuestions) {
        selectedCategory = topic;
        questions = icebreakerQuestions[topic as keyof typeof icebreakerQuestions];
      } else {
        // General: randomly select a category
        const categories = Object.keys(icebreakerQuestions);
        selectedCategory = categories[Math.floor(Math.random() * categories.length)];
        questions = icebreakerQuestions[selectedCategory as keyof typeof icebreakerQuestions];
      }
      
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      const categoryInfo = categoryLabels[selectedCategory] || { name: "破冰问题", color: "gray" };
      
      res.json({ 
        question: randomQuestion,
        category: categoryInfo.name,
        categoryColor: categoryInfo.color
      });
    } catch (error) {
      logger.error("Error fetching icebreaker", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch icebreaker question" });
    }
  });

  // AI-powered topic recommendations for icebreaker toolkit
  app.post('/api/icebreaker/ai-topics', requireAuth, async (req: any, res) => {
    try {
      const { participants, atmosphereType = 'balanced', count = 5 } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { getAIRecommendedTopics, getQuickRecommendedTopics, getAllTopicsForToolkit } = await import('../../topicRecommendationService');
      
      // Get AI recommendations with personalized reasons
      const recommendedTopics = await getAIRecommendedTopics(participants, atmosphereType, count);
      
      // Get all available topics for the full toolkit
      const archetypes = participants.map((p: any) => p.archetype).filter(Boolean);
      const allTopics = getAllTopicsForToolkit(archetypes, atmosphereType);
      
      res.json({
        recommendedTopics,
        allTopics,
      });
    } catch (error) {
      logger.error("Error fetching AI topic recommendations", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch AI topic recommendations" });
    }
  });

  // Quick (non-AI) topic recommendations for faster loading
  app.post('/api/icebreaker/quick-topics', requireAuth, async (req: any, res) => {
    try {
      const { archetypes = [], atmosphereType = 'balanced', count = 5 } = req.body;
      
      const { getQuickRecommendedTopics, getAllTopicsForToolkit } = await import('../../topicRecommendationService');
      
      // Get quick local recommendations (no AI call)
      const recommendedTopics = getQuickRecommendedTopics(archetypes, atmosphereType, count);
      
      // Get all available topics
      const allTopics = getAllTopicsForToolkit(archetypes, atmosphereType);
      
      res.json({
        recommendedTopics,
        allTopics,
      });
    } catch (error) {
      logger.error("Error fetching quick topic recommendations", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch quick topic recommendations" });
    }
  });

  // AI-powered welcome message for icebreaker session
  app.post('/api/icebreaker/welcome-message', requireAuth, async (req: any, res) => {
    try {
      const { participants, eventTitle } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { generateWelcomeMessage, generateQuickWelcome } = await import('../../icebreakerAIService');
      
      // Try AI generation, fallback to quick generation
      let message: string;
      try {
        message = await generateWelcomeMessage(participants, eventTitle);
      } catch {
        const archetypes = participants.map((p: any) => p.archetype).filter(Boolean);
        message = await generateQuickWelcome(participants.length, archetypes);
      }
      
      res.json({ message });
    } catch (error) {
      logger.error("Error generating welcome message", { error: String(error) });
      res.status(500).json({ message: "Failed to generate welcome message" });
    }
  });

  // AI-powered closing message for icebreaker session
  app.post('/api/icebreaker/closing-message', requireAuth, async (req: any, res) => {
    try {
      const { participants, durationMinutes, topicsDiscussed, gamesPlayed } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { generateClosingMessage } = await import('../../icebreakerAIService');
      
      const message = await generateClosingMessage(
        participants,
        durationMinutes || 0,
        topicsDiscussed,
        gamesPlayed
      );
      
      res.json({ message });
    } catch (error) {
      logger.error("Error generating closing message", { error: String(error) });
      res.status(500).json({ message: "Failed to generate closing message" });
    }
  });

  // Generate cards for current round
  
  // Get cards for a session
  
  // Record card interaction
  
  // Get game progress

  // Notification endpoints
  app.get('/api/notifications/counts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const counts = await storage.getNotificationCounts(userId);
      res.json(counts);
    } catch (error) {
      logger.error("Error fetching notification counts", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch notification counts" });
    }
  });

  app.post('/api/notifications/mark-read', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { category } = req.body;
      if (!category || !['discover', 'activities', 'chat'].includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      await storage.markNotificationsAsRead(userId, category);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error marking notifications as read", { error: String(error) });
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

}
