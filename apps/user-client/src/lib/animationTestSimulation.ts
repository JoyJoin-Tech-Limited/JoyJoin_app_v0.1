/**
 * Match Reveal Animation - 50 User Test Simulation
 * 模擬50個用戶與動畫互動的詳細數據
 */

export interface UserTestSession {
  userId: string;
  userName: string;
  archetype: string;
  sessionId: string;
  timestamp: number;
  events: Array<{
    type: 'view' | 'skip' | 'share' | 'complete' | 'replay';
    time: number;
    durationInAnimation?: number;
    interactionPoint?: string;
  }>;
  metadata: {
    device: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    networkSpeed: 'fast' | 'normal' | 'slow';
    completionRate: 'full' | 'partial' | 'skip';
    satisfactionScore: number; // 1-5
    feedbackText: string;
  };
}

const archetypes = ['開心柯基', '太陽雞', '夸夸豚', '機智狐', '淡定海豚', '織網蛛', '暖心熊', '靈感章魚', '沉思貓頭鷹', '定心大象', '穩如龜', '隱身貓'];
const browsers = ['Chrome', 'Safari', 'WeChat', 'Firefox', 'Samsung Browser'];
const devices = ['mobile', 'tablet', 'desktop'] as const;

/**
 * Generate 50 user test sessions with realistic behavior patterns
 */
export const generateTestSessions = (): UserTestSession[] => {
  const sessions: UserTestSession[] = [];
  
  for (let i = 1; i <= 50; i++) {
    const userId = `test_user_${i}`;
    const archetype = archetypes[i % archetypes.length];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const networkSpeed = Math.random() > 0.7 ? 'slow' : Math.random() > 0.4 ? 'normal' : 'fast';
    
    // Simulate different user behavior patterns
    const behaviorPattern = Math.random();
    let events = [];
    let completionRate: 'full' | 'partial' | 'skip' = 'full';
    let satisfactionScore = 5;
    let feedbackText = '';
    
    // 65% complete the full animation
    if (behaviorPattern < 0.65) {
      events = [
        { type: 'view' as const, time: 100, durationInAnimation: 100 },
        { type: 'complete' as const, time: 6500, durationInAnimation: 6500, interactionPoint: 'natural_end' },
      ];
      // 30% of completers replay
      if (Math.random() < 0.30) {
        events.push({ type: 'replay' as const, time: 8000, interactionPoint: 'ending_screen' });
        events.push({ type: 'complete' as const, time: 14500 });
      }
      // 40% of completers share
      if (Math.random() < 0.40) {
        events.push({ type: 'share' as const, time: 6800, interactionPoint: 'ending_screen' });
      }
      satisfactionScore = 4 + Math.random();
      feedbackText = device === 'mobile' 
        ? '很棒的體驗！動畫流暢，配樂很帶感。'
        : '動畫精美，12個角色各有特色。視覺效果很棒！';
    }
    // 20% skip at various points
    else if (behaviorPattern < 0.85) {
      const skipTime = 500 + Math.random() * 5000;
      events = [
        { type: 'view' as const, time: 100 },
        { type: 'skip' as const, time: Math.floor(skipTime), durationInAnimation: Math.floor(skipTime), interactionPoint: skipTime < 2000 ? 'act1' : skipTime < 4000 ? 'act2' : 'act3' },
      ];
      completionRate = 'skip';
      satisfactionScore = 2 + Math.random() * 2;
      feedbackText = skipTime < 2000 
        ? '盲盒部分有點長，想快速看到隊友。'
        : skipTime < 4000
        ? '有點期待團圓部分，但中途跳過了。'
        : '快要結束了才跳過的，可惜。';
    }
    // 15% have network issues or partial view
    else {
      const viewDuration = 1000 + Math.random() * 3000;
      events = [
        { type: 'view' as const, time: 100, durationInAnimation: Math.floor(viewDuration), interactionPoint: 'loading_interrupted' },
      ];
      completionRate = 'partial';
      satisfactionScore = 1 + Math.random() * 2;
      feedbackText = networkSpeed === 'slow'
        ? '網速有點慢，動畫卡頓了。'
        : '中途出現問題，沒看完。';
    }
    
    sessions.push({
      userId,
      userName: `用戶${i}`,
      archetype,
      sessionId: `session_${i}_${Date.now()}`,
      timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
      events,
      metadata: {
        device,
        browser: browsers[Math.floor(Math.random() * browsers.length)],
        networkSpeed,
        completionRate,
        satisfactionScore,
        feedbackText,
      },
    });
  }
  
  return sessions;
};

/**
 * Generate comprehensive test report
 */
export const generateTestReport = (sessions: UserTestSession[]) => {
  const report = {
    totalSessions: sessions.length,
    completionStats: {
      fullCompletion: sessions.filter(s => s.metadata.completionRate === 'full').length,
      partialView: sessions.filter(s => s.metadata.completionRate === 'partial').length,
      skipRate: sessions.filter(s => s.metadata.completionRate === 'skip').length,
    },
    replayStats: {
      totalReplays: sessions.reduce((sum, s) => sum + s.events.filter(e => e.type === 'replay').length, 0),
      replayPercentage: 0,
    },
    shareStats: {
      totalShares: sessions.reduce((sum, s) => sum + s.events.filter(e => e.type === 'share').length, 0),
      sharePercentage: 0,
    },
    satisfactionStats: {
      averageScore: 0,
      distribution: { '1星': 0, '2星': 0, '3星': 0, '4星': 0, '5星': 0 },
    },
    deviceStats: {
      mobile: sessions.filter(s => s.metadata.device === 'mobile').length,
      tablet: sessions.filter(s => s.metadata.device === 'tablet').length,
      desktop: sessions.filter(s => s.metadata.device === 'desktop').length,
    },
    browserStats: {} as Record<string, number>,
    networkStats: {
      fast: sessions.filter(s => s.metadata.networkSpeed === 'fast').length,
      normal: sessions.filter(s => s.metadata.networkSpeed === 'normal').length,
      slow: sessions.filter(s => s.metadata.networkSpeed === 'slow').length,
    },
    archetypePopularity: {} as Record<string, number>,
    skipPointAnalysis: {} as Record<string, number>,
    averageSessionDuration: 0,
    userFeedbackSummary: [] as Array<{ score: number; feedback: string; device: string; archetype: string }>,
  };

  // Calculate stats
  report.replayStats.replayPercentage = (report.replayStats.totalReplays / sessions.length) * 100;
  report.shareStats.sharePercentage = (report.shareStats.totalShares / sessions.length) * 100;

  let totalScore = 0;
  let totalDuration = 0;
  let sessionCount = 0;

  sessions.forEach(session => {
    // Satisfaction stats
    totalScore += session.metadata.satisfactionScore;
    const scoreInt = Math.ceil(session.metadata.satisfactionScore);
    report.satisfactionStats.distribution[`${scoreInt}星` as any]++;

    // Browser stats
    report.browserStats[session.metadata.browser] = (report.browserStats[session.metadata.browser] || 0) + 1;

    // Archetype popularity
    report.archetypePopularity[session.archetype] = (report.archetypePopularity[session.archetype] || 0) + 1;

    // Skip point analysis
    session.events.forEach(event => {
      if (event.type === 'skip' && event.interactionPoint) {
        report.skipPointAnalysis[event.interactionPoint] = (report.skipPointAnalysis[event.interactionPoint] || 0) + 1;
      }
    });

    // Session duration
    const lastEvent = session.events[session.events.length - 1];
    if (lastEvent) {
      totalDuration += lastEvent.time;
      sessionCount++;
    }

    // Feedback summary
    report.userFeedbackSummary.push({
      score: session.metadata.satisfactionScore,
      feedback: session.metadata.feedbackText,
      device: session.metadata.device,
      archetype: session.archetype,
    });
  });

  report.satisfactionStats.averageScore = totalScore / sessions.length;
  report.averageSessionDuration = sessionCount > 0 ? totalDuration / sessionCount : 0;

  return report;
};
