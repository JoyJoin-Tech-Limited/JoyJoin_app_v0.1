import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shuffle, RotateCcw, Users } from 'lucide-react';
import { PokerCard } from './PokerCard';

interface Card {
  id: string;
  number?: number;
  isKing: boolean;
}

interface KingGameCardDeckProps {
  playerCount: number;
  onCardReveal?: (card: Card, index: number) => void;
  onKingRevealed?: (tableCardNumber: number) => void;
  onAllCardsDealt?: (tableCardNumber: number) => void;
  onRoundComplete?: () => void;
}

function generateDeck(playerCount: number): Card[] {
  const cards: Card[] = [];
  
  for (let i = 1; i <= playerCount; i++) {
    cards.push({ id: `num-${i}`, number: i, isKing: false });
  }
  cards.push({ id: 'king', isKing: true });
  
  return cards;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function KingGameCardDeck({
  playerCount,
  onCardReveal,
  onKingRevealed,
  onAllCardsDealt,
  onRoundComplete,
}: KingGameCardDeckProps) {
  const [deck, setDeck] = useState<Card[]>(() => shuffleArray(generateDeck(playerCount)));
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const [isShuffling, setIsShuffling] = useState(false);
  const [dealPhase, setDealPhase] = useState<'ready' | 'dealing' | 'dealt'>('ready');

  const cardCount = playerCount + 1;

  const handleShuffle = useCallback(async () => {
    setIsShuffling(true);
    setFlippedCards(new Set());
    setRevealedCards(new Set());
    setDealPhase('ready');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setDeck(shuffleArray(generateDeck(playerCount)));
    
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsShuffling(false);
  }, [playerCount]);

  const handleDeal = useCallback(async () => {
    setDealPhase('dealing');
    await new Promise(resolve => setTimeout(resolve, 800));
    setDealPhase('dealt');
  }, []);

  const handleCardClick = useCallback((card: Card, index: number) => {
    if (dealPhase !== 'dealt') return;
    if (flippedCards.has(card.id)) return;

    const newFlipped = new Set(flippedCards);
    newFlipped.add(card.id);
    setFlippedCards(newFlipped);

    onCardReveal?.(card, index);

    if (card.isKing) {
      setRevealedCards(prev => new Set(prev).add(card.id));
    }
    
    // Check if all players have drawn (N cards flipped, 1 remains on table)
    // Only then do we know the true table card number
    if (newFlipped.size === playerCount) {
      const remainingCard = deck.find(c => !newFlipped.has(c.id));
      if (remainingCard?.number) {
        // Check if King was already revealed in this round
        const kingWasRevealed = deck.some(c => c.isKing && newFlipped.has(c.id));
        if (kingWasRevealed) {
          onKingRevealed?.(remainingCard.number);
        }
        onAllCardsDealt?.(remainingCard.number);
      }
    }
  }, [dealPhase, flippedCards, deck, playerCount, onCardReveal, onKingRevealed, onAllCardsDealt]);

  const handleRevealNumber = useCallback((cardId: string) => {
    setRevealedCards(prev => new Set(prev).add(cardId));
  }, []);

  const handleNewRound = useCallback(() => {
    handleShuffle();
    onRoundComplete?.();
  }, [handleShuffle, onRoundComplete]);

  const kingCard = useMemo(() => deck.find(c => c.isKing && flippedCards.has(c.id)), [deck, flippedCards]);
  const tableCard = useMemo(() => {
    const flippedCardIds = Array.from(flippedCards);
    return deck.find(c => !flippedCardIds.includes(c.id));
  }, [deck, flippedCards]);

  const allCardsDealt = flippedCards.size === playerCount;

  return (
    <div className="flex flex-col items-center gap-4 p-4" data-testid="king-game-deck">
      {/* Header with player count */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {playerCount} 人
        </Badge>
        <Badge variant="outline">
          {cardCount} 张牌
        </Badge>
        <span className="text-sm text-muted-foreground">
          (1-{playerCount}号 + 国王)
        </span>
      </div>

      {/* Card Display Area */}
      <div className="relative min-h-[200px] w-full flex items-center justify-center">
        <AnimatePresence mode="sync">
          {dealPhase === 'ready' && (
            <motion.div
              key="stack"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative"
            >
              {/* Stacked cards */}
              {deck.slice(0, 5).map((_, idx) => (
                <motion.div
                  key={idx}
                  className="absolute"
                  style={{
                    top: idx * -2,
                    left: idx * 2,
                    zIndex: 5 - idx,
                  }}
                  animate={isShuffling ? {
                    x: [0, (idx % 2 === 0 ? 1 : -1) * 20, 0],
                    rotate: [0, (idx % 2 === 0 ? 1 : -1) * 10, 0],
                  } : {}}
                  transition={{ duration: 0.3, repeat: isShuffling ? 2 : 0 }}
                >
                  <PokerCard
                    isFlipped={false}
                    size="lg"
                    disabled
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {dealPhase === 'dealing' && (
            <motion.div
              key="dealing"
              className="flex items-center justify-center gap-2"
            >
              {deck.map((card, idx) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: -100, scale: 0.5 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: idx * 0.1, duration: 0.3 }}
                >
                  <PokerCard
                    isFlipped={false}
                    size="md"
                    disabled
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {dealPhase === 'dealt' && (
            <motion.div
              key="dealt"
              className="flex flex-wrap items-center justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {deck.map((card, idx) => (
                <motion.div
                  key={card.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={!flippedCards.has(card.id) ? { scale: 1.05 } : {}}
                  whileTap={!flippedCards.has(card.id) ? { scale: 0.95 } : {}}
                >
                  <PokerCard
                    number={card.number}
                    isKing={card.isKing}
                    isFlipped={flippedCards.has(card.id)}
                    isRevealed={revealedCards.has(card.id)}
                    onClick={() => handleCardClick(card, idx)}
                    size="md"
                    disabled={flippedCards.has(card.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Game Status */}
      {dealPhase === 'dealt' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          {!kingCard && (
            <p className="text-sm text-muted-foreground">
              点击卡牌翻开 · 已翻 {flippedCards.size}/{cardCount} 张
            </p>
          )}
          
          {kingCard && !allCardsDealt && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <p className="text-amber-700 dark:text-amber-300 font-medium">
                国王已现身! 还剩 {cardCount - flippedCards.size} 张牌未翻开
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                桌上剩的那张就是国王的号码哦~
              </p>
            </div>
          )}

          {allCardsDealt && tableCard && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/10 rounded-lg p-4 space-y-2"
            >
              <p className="font-medium text-primary">
                所有人都拿到牌了!
              </p>
              <p className="text-sm text-muted-foreground">
                国王的号码是: <span className="font-bold text-primary">{tableCard.number}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                (但国王自己不能看!)
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Revealed Numbers for Commands */}
      {kingCard && flippedCards.size > 1 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {deck.filter(c => flippedCards.has(c.id) && !c.isKing).map(card => (
            <Button
              key={card.id}
              variant={revealedCards.has(card.id) ? "default" : "outline"}
              size="sm"
              onClick={() => handleRevealNumber(card.id)}
              className="min-w-[50px]"
              data-testid={`reveal-btn-${card.number}`}
            >
              {card.number}号
            </Button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        {dealPhase === 'ready' && (
          <>
            <Button
              variant="outline"
              onClick={handleShuffle}
              disabled={isShuffling}
              data-testid="button-shuffle"
            >
              <Shuffle className={`w-4 h-4 mr-2 ${isShuffling ? 'animate-spin' : ''}`} />
              洗牌
            </Button>
            <Button
              onClick={handleDeal}
              disabled={isShuffling}
              data-testid="button-deal"
            >
              发牌
            </Button>
          </>
        )}

        {dealPhase === 'dealt' && (
          <Button
            variant="outline"
            onClick={handleNewRound}
            data-testid="button-new-round"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            新一轮
          </Button>
        )}
      </div>
    </div>
  );
}

export default KingGameCardDeck;
