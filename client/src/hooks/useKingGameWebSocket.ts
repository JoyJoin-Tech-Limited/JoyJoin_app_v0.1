import { useEffect, useCallback, useState, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import type { 
  WSMessage,
  KingGamePlayerJoinedData,
  KingGamePlayerReadyData,
  KingGameStartDealData,
  KingGameCardDealtData,
  KingGameAllCardsDrawnData,
  KingGameKingRevealedData,
  KingGameCommandIssuedData,
  KingGameRoundCompleteData,
  KingGameStateSyncData,
  RateLimitedData,
} from '@/../../shared/wsEvents';

export type KingGamePhase = 'waiting' | 'dealing' | 'commanding' | 'executing' | 'completed';

interface KingGamePlayer {
  userId: string;
  displayName: string;
  isReady: boolean;
  hasDrawnCard?: boolean;
  isKing?: boolean;
  isDealer?: boolean;
}

export interface KingGameState {
  sessionId: string;
  phase: KingGamePhase;
  playerCount: number;
  requiredPlayers: number;
  roundNumber: number;
  players: KingGamePlayer[];
  dealerId: string | null;
  dealerName: string | null;
  kingUserId: string | null;
  kingDisplayName: string | null;
  mysteryNumber: number | null;
  currentCommand: string | null;
  targetNumber: number | null;
  myCardNumber: number | null;
  myIsKing: boolean;
  drawnCount: number;
  readyCount: number;
}

interface UseKingGameWebSocketOptions {
  sessionId: string;
  icebreakerSessionId: string;
  userId: string;
  displayName: string;
  playerCount: number;
  onPlayerJoined?: (data: KingGamePlayerJoinedData) => void;
  onPlayerReady?: (data: KingGamePlayerReadyData) => void;
  onDealStart?: (data: KingGameStartDealData) => void;
  onCardDealt?: (data: KingGameCardDealtData) => void;
  onAllCardsDrawn?: (data: KingGameAllCardsDrawnData) => void;
  onKingRevealed?: (data: KingGameKingRevealedData) => void;
  onCommandIssued?: (data: KingGameCommandIssuedData) => void;
  onRoundComplete?: (data: KingGameRoundCompleteData) => void;
  onStateSync?: (data: KingGameStateSyncData) => void;
  onRateLimited?: (data: RateLimitedData) => void;
}

export function useKingGameWebSocket(options: UseKingGameWebSocketOptions) {
  const {
    sessionId,
    icebreakerSessionId,
    userId,
    displayName,
    playerCount: requiredPlayers,
    onPlayerJoined,
    onPlayerReady,
    onDealStart,
    onCardDealt,
    onAllCardsDrawn,
    onKingRevealed,
    onCommandIssued,
    onRoundComplete,
    onStateSync,
    onRateLimited,
  } = options;

  const [state, setState] = useState<KingGameState>({
    sessionId,
    phase: 'waiting',
    playerCount: 0,
    requiredPlayers,
    roundNumber: 1,
    players: [],
    dealerId: null,
    dealerName: null,
    kingUserId: null,
    kingDisplayName: null,
    mysteryNumber: null,
    currentCommand: null,
    targetNumber: null,
    myCardNumber: null,
    myIsKing: false,
    drawnCount: 0,
    readyCount: 0,
  });

  const hasJoinedRef = useRef(false);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'KING_GAME_PLAYER_JOINED': {
        const data = message.data as KingGamePlayerJoinedData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            players: data.players.map(p => ({
              userId: p.userId,
              displayName: p.displayName,
              isReady: p.isReady,
              isDealer: p.isDealer,
            })),
            playerCount: data.playerCount,
          }));
          onPlayerJoined?.(data);
        }
        break;
      }

      case 'KING_GAME_PLAYER_READY': {
        const data = message.data as KingGamePlayerReadyData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            readyCount: data.readyCount,
            players: prev.players.map(p => 
              p.userId === data.userId ? { ...p, isReady: true } : p
            ),
          }));
          onPlayerReady?.(data);
        }
        break;
      }

      case 'KING_GAME_START_DEAL': {
        const data = message.data as KingGameStartDealData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: 'dealing',
            dealerId: data.dealerId,
            dealerName: data.dealerName,
            drawnCount: 0,
            myCardNumber: null,
            myIsKing: false,
          }));
          onDealStart?.(data);
        }
        break;
      }

      case 'KING_GAME_CARD_DEALT': {
        const data = message.data as KingGameCardDealtData;
        if (data.sessionId === sessionId && data.userId === userId) {
          setState(prev => ({
            ...prev,
            myCardNumber: data.cardNumber,
            myIsKing: data.isKing,
            drawnCount: data.drawnCount,
          }));
          onCardDealt?.(data);
        }
        break;
      }

      case 'KING_GAME_ALL_CARDS_DRAWN': {
        const data = message.data as KingGameAllCardsDrawnData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            drawnCount: data.drawnCount,
          }));
          onAllCardsDrawn?.(data);
        }
        break;
      }

      case 'KING_GAME_KING_REVEALED': {
        const data = message.data as KingGameKingRevealedData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: 'commanding',
            kingUserId: data.kingUserId,
            kingDisplayName: data.kingDisplayName,
            mysteryNumber: data.mysteryNumber,
          }));
          onKingRevealed?.(data);
        }
        break;
      }

      case 'KING_GAME_COMMAND_ISSUED': {
        const data = message.data as KingGameCommandIssuedData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: 'executing',
            currentCommand: data.command,
            targetNumber: data.targetNumber,
          }));
          onCommandIssued?.(data);
        }
        break;
      }

      case 'KING_GAME_ROUND_COMPLETE': {
        const data = message.data as KingGameRoundCompleteData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: 'waiting',
            roundNumber: data.roundNumber + 1,
            kingUserId: null,
            kingDisplayName: null,
            mysteryNumber: null,
            currentCommand: null,
            targetNumber: null,
            myCardNumber: null,
            myIsKing: false,
            drawnCount: 0,
            readyCount: 0,
            players: prev.players.map(p => ({ ...p, isReady: false, hasDrawnCard: false })),
          }));
          onRoundComplete?.(data);
        }
        break;
      }

      case 'KING_GAME_STATE_SYNC': {
        const data = message.data as KingGameStateSyncData;
        if (data.sessionId === sessionId) {
          setState(prev => ({
            ...prev,
            phase: data.phase,
            playerCount: data.players.length,
            roundNumber: data.roundNumber,
            players: data.players,
            dealerId: data.dealerId,
            kingUserId: data.kingUserId,
            mysteryNumber: data.mysteryNumber,
            currentCommand: data.currentCommand,
            targetNumber: data.targetNumber,
            myCardNumber: data.myCardNumber,
            myIsKing: data.myIsKing,
          }));
          onStateSync?.(data);
        }
        break;
      }

      case 'RATE_LIMITED': {
        const data = message.data as RateLimitedData;
        onRateLimited?.(data);
        break;
      }
    }
  }, [sessionId, userId, onPlayerJoined, onPlayerReady, onDealStart, onCardDealt, onAllCardsDrawn, onKingRevealed, onCommandIssued, onRoundComplete, onStateSync, onRateLimited]);

  const { isConnected, isReconnecting, send, subscribe, disconnect } = useWebSocket({
    userId,
    onMessage: handleMessage,
    autoConnect: true,
  });

  useEffect(() => {
    if (isConnected && sessionId && userId && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      send({
        type: 'KING_GAME_JOIN',
        userId,
        data: { 
          sessionId,
          icebreakerSessionId,
          displayName,
          playerCount: requiredPlayers,
        },
      });
    }
  }, [isConnected, sessionId, icebreakerSessionId, userId, displayName, requiredPlayers, send]);

  useEffect(() => {
    if (!isConnected) {
      hasJoinedRef.current = false;
    }
  }, [isConnected]);

  const setReady = useCallback(() => {
    send({
      type: 'KING_GAME_PLAYER_READY',
      userId,
      data: { sessionId },
    });
  }, [send, userId, sessionId]);

  const startDeal = useCallback(() => {
    send({
      type: 'KING_GAME_START_DEAL',
      userId,
      data: { sessionId },
    });
  }, [send, userId, sessionId]);

  const drawCard = useCallback(() => {
    send({
      type: 'KING_GAME_CARD_DEALT',
      userId,
      data: { sessionId },
    });
  }, [send, userId, sessionId]);

  const issueCommand = useCallback((command: string, targetNumber: number) => {
    send({
      type: 'KING_GAME_COMMAND_ISSUED',
      userId,
      data: { sessionId, command, targetNumber },
    });
  }, [send, userId, sessionId]);

  const completeRound = useCallback(() => {
    send({
      type: 'KING_GAME_ROUND_COMPLETE',
      userId,
      data: { sessionId },
    });
  }, [send, userId, sessionId]);

  const requestStateSync = useCallback(() => {
    send({
      type: 'KING_GAME_STATE_SYNC',
      userId,
      data: { sessionId },
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
    setReady,
    startDeal,
    drawCard,
    issueCommand,
    completeRound,
    requestStateSync,
    leave,
    subscribe,
  };
}
