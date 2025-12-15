import { useEffect, useCallback, useState, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import type { 
  WSMessage,
  IcebreakerCheckinUpdateData,
  IcebreakerPhaseChangeData,
  IcebreakerNumberAssignedData,
  IcebreakerReadyCountUpdateData,
  IcebreakerTopicSelectedData,
  IcebreakerGameStartedData,
  IcebreakerSessionEndedData,
  IcebreakerUserStatusData,
  RateLimitedData,
} from '@/../../shared/wsEvents';

export type IcebreakerPhase = 'waiting' | 'checkin' | 'number_assign' | 'icebreaker' | 'ended';

const isDevelopment = import.meta.env.DEV;
const DEMO_MODE_TIMEOUT = 3000; // Switch to demo mode if WS doesn't connect in 3s

export interface IcebreakerState {
  sessionId: string;
  phase: IcebreakerPhase;
  checkedInCount: number;
  expectedAttendees: number;
  checkins: Array<{
    userId: string;
    displayName: string;
    archetype: string | null;
    numberPlate: number | null;
  }>;
  myNumberPlate: number | null;
  numberAssignments: Array<{
    userId: string;
    displayName: string;
    numberPlate: number;
  }>;
  readyCount: number;
  readyRatio: number;
  selectedTopic: { id: string; title: string; selectedBy: string } | null;
  currentGame: { id: string; name: string; startedBy: string } | null;
  aiClosingMessage: string | null;
  duration: number;
}

interface UseIcebreakerWebSocketOptions {
  sessionId: string;
  userId: string;
  expectedAttendees?: number;
  onPhaseChange?: (phase: IcebreakerPhase, previousPhase: string) => void;
  onCheckinUpdate?: (data: IcebreakerCheckinUpdateData) => void;
  onNumberAssigned?: (data: IcebreakerNumberAssignedData) => void;
  onReadyCountUpdate?: (data: IcebreakerReadyCountUpdateData) => void;
  onTopicSelected?: (data: IcebreakerTopicSelectedData) => void;
  onGameStarted?: (data: IcebreakerGameStartedData) => void;
  onSessionEnded?: (data: IcebreakerSessionEndedData) => void;
  onUserOffline?: (data: IcebreakerUserStatusData) => void;
  onUserReconnected?: (data: IcebreakerUserStatusData) => void;
  onRateLimited?: (data: RateLimitedData) => void;
}

export function useIcebreakerWebSocket(options: UseIcebreakerWebSocketOptions) {
  const {
    sessionId,
    userId,
    expectedAttendees = 0,
    onPhaseChange,
    onCheckinUpdate,
    onNumberAssigned,
    onReadyCountUpdate,
    onTopicSelected,
    onGameStarted,
    onSessionEnded,
    onUserOffline,
    onUserReconnected,
    onRateLimited,
  } = options;

  const [state, setState] = useState<IcebreakerState>({
    sessionId,
    phase: 'waiting',
    checkedInCount: 0,
    expectedAttendees,
    checkins: [],
    myNumberPlate: null,
    numberAssignments: [],
    readyCount: 0,
    readyRatio: 0,
    selectedTopic: null,
    currentGame: null,
    aiClosingMessage: null,
    duration: 0,
  });

  const [isDemoMode, setIsDemoMode] = useState(false);
  const demoModeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const demoPhaseTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'ICEBREAKER_CHECKIN_UPDATE': {
        const data = message.data as IcebreakerCheckinUpdateData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            checkedInCount: data.checkedInCount,
            expectedAttendees: data.expectedAttendees,
            checkins: data.checkins,
          }));
          onCheckinUpdate?.(data);
        }
        break;
      }

      case 'ICEBREAKER_PHASE_CHANGE': {
        const data = message.data as IcebreakerPhaseChangeData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: data.phase,
          }));
          onPhaseChange?.(data.phase, data.previousPhase);
        }
        break;
      }

      case 'ICEBREAKER_NUMBER_ASSIGNED': {
        const data = message.data as IcebreakerNumberAssignedData;
        if (data.sessionId === sessionId) {
          const myAssignment = data.assignments.find(a => a.userId === userId);
          setState(prev => ({
            ...prev,
            numberAssignments: data.assignments,
            myNumberPlate: myAssignment?.numberPlate ?? null,
          }));
          onNumberAssigned?.(data);
        }
        break;
      }

      case 'ICEBREAKER_READY_COUNT_UPDATE': {
        const data = message.data as IcebreakerReadyCountUpdateData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            readyCount: data.readyCount,
            readyRatio: data.readyRatio,
          }));
          onReadyCountUpdate?.(data);
        }
        break;
      }

      case 'ICEBREAKER_TOPIC_SELECTED': {
        const data = message.data as IcebreakerTopicSelectedData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            selectedTopic: {
              id: data.topicId,
              title: data.topicTitle,
              selectedBy: data.selectedBy,
            },
          }));
          onTopicSelected?.(data);
        }
        break;
      }

      case 'ICEBREAKER_GAME_STARTED': {
        const data = message.data as IcebreakerGameStartedData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            currentGame: {
              id: data.gameId,
              name: data.gameName,
              startedBy: data.startedBy,
            },
          }));
          onGameStarted?.(data);
        }
        break;
      }

      case 'ICEBREAKER_SESSION_ENDED': {
        const data = message.data as IcebreakerSessionEndedData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: 'ended',
            aiClosingMessage: data.aiClosingMessage ?? null,
            duration: data.duration,
          }));
          onSessionEnded?.(data);
        }
        break;
      }

      case 'ICEBREAKER_USER_OFFLINE': {
        const data = message.data as IcebreakerUserStatusData;
        if (data.sessionId === sessionId) {
          onUserOffline?.(data);
        }
        break;
      }

      case 'ICEBREAKER_USER_RECONNECTED': {
        const data = message.data as IcebreakerUserStatusData;
        if (data.sessionId === sessionId) {
          onUserReconnected?.(data);
        }
        break;
      }

      case 'RATE_LIMITED': {
        const data = message.data as RateLimitedData;
        onRateLimited?.(data);
        break;
      }
    }
  }, [sessionId, userId, onPhaseChange, onCheckinUpdate, onNumberAssigned, onReadyCountUpdate, onTopicSelected, onGameStarted, onSessionEnded, onUserOffline, onUserReconnected, onRateLimited]);

  const { isConnected, isReconnecting, send, subscribe, disconnect } = useWebSocket({
    userId,
    onMessage: handleMessage,
    autoConnect: true,
  });

  // Helper to clear all demo phase timeouts
  const clearDemoTimeouts = useCallback(() => {
    if (demoModeTimeoutRef.current) {
      clearTimeout(demoModeTimeoutRef.current);
      demoModeTimeoutRef.current = null;
    }
    demoPhaseTimeoutsRef.current.forEach(t => clearTimeout(t));
    demoPhaseTimeoutsRef.current = [];
  }, []);

  // Demo mode: In development, if WS doesn't connect within timeout, switch to demo mode
  // Simulate phase transitions for a complete demo experience
  useEffect(() => {
    // Only start demo mode timer if not connected and not already in demo mode
    if (isDevelopment && !isConnected && !isDemoMode) {
      demoModeTimeoutRef.current = setTimeout(() => {
        console.log('[Icebreaker] WebSocket not available, switching to demo mode');
        
        const demoUserId = userId || 'demo-user';
        const demoCheckins = [{
          userId: demoUserId,
          displayName: 'Demo User',
          archetype: null,
          numberPlate: null as number | null,
        }];
        const demoAssignments = [{
          userId: demoUserId,
          displayName: 'Demo User',
          numberPlate: 1,
        }];
        
        // Phase 1: Start at 'checkin' phase
        setState(prev => ({
          ...prev,
          phase: 'checkin',
          checkedInCount: 1,
          expectedAttendees: Math.max(1, prev.expectedAttendees),
          checkins: demoCheckins,
        }));
        onPhaseChange?.('checkin', 'waiting');
        
        // Phase 2: After 1.5s, move to 'number_assign' phase
        const phase2Timeout = setTimeout(() => {
          setState(prev => ({
            ...prev,
            phase: 'number_assign',
            myNumberPlate: 1,
            numberAssignments: demoAssignments,
            checkins: demoCheckins.map(c => ({ ...c, numberPlate: 1 })),
          }));
          onPhaseChange?.('number_assign', 'checkin');
          
          // Phase 3: After another 2s, move to 'icebreaker' phase
          const phase3Timeout = setTimeout(() => {
            setState(prev => ({
              ...prev,
              phase: 'icebreaker',
            }));
            onPhaseChange?.('icebreaker', 'number_assign');
          }, 2000);
          demoPhaseTimeoutsRef.current.push(phase3Timeout);
        }, 1500);
        demoPhaseTimeoutsRef.current.push(phase2Timeout);
        
        // Set demo mode after scheduling all phase transitions
        setIsDemoMode(true);
      }, DEMO_MODE_TIMEOUT);
      
      // Cleanup only the initial timeout if effect re-runs before demo starts
      return () => {
        if (demoModeTimeoutRef.current) {
          clearTimeout(demoModeTimeoutRef.current);
          demoModeTimeoutRef.current = null;
        }
      };
    }
    
    return undefined;
  }, [isConnected, isDemoMode, userId, onPhaseChange]);

  // Separate effect: Clear all demo timeouts when real connection opens
  useEffect(() => {
    if (isConnected && isDemoMode) {
      clearDemoTimeouts();
      setIsDemoMode(false);
    }
  }, [isConnected, isDemoMode, clearDemoTimeouts]);

  // Cleanup all demo timeouts on unmount
  useEffect(() => {
    return () => {
      clearDemoTimeouts();
    };
  }, [clearDemoTimeouts]);

  useEffect(() => {
    if (isConnected && sessionId && userId) {
      send({
        type: 'ICEBREAKER_JOIN_SESSION',
        userId,
        data: { sessionId },
      });
    }
  }, [isConnected, sessionId, userId, send]);

  const checkin = useCallback(() => {
    send({
      type: 'ICEBREAKER_CHECKIN',
      userId,
      data: { sessionId },
    });
  }, [send, userId, sessionId]);

  const voteReady = useCallback((phase: string, isAuto: boolean = false) => {
    send({
      type: 'ICEBREAKER_READY_VOTE',
      userId,
      data: { sessionId, phase, isAutoVote: isAuto },
    });
  }, [send, userId, sessionId]);

  const selectTopic = useCallback((topicId: string, topicTitle: string) => {
    send({
      type: 'ICEBREAKER_TOPIC_SELECTED',
      userId,
      data: { sessionId, topicId, topicTitle, selectedBy: userId },
    });
  }, [send, userId, sessionId]);

  const startGame = useCallback((gameId: string, gameName: string) => {
    send({
      type: 'ICEBREAKER_GAME_STARTED',
      userId,
      data: { sessionId, gameId, gameName, startedBy: userId },
    });
  }, [send, userId, sessionId]);

  const leave = useCallback(() => {
    send({
      type: 'USER_LEFT',
      userId,
      data: { sessionId },
    });
    disconnect();
  }, [send, userId, sessionId, disconnect]);

  return {
    state,
    isConnected,
    isReconnecting,
    isDemoMode,
    checkin,
    voteReady,
    selectTopic,
    startGame,
    leave,
    subscribe,
  };
}
