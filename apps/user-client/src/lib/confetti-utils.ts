import confetti from 'canvas-confetti';

export const confettiPresets = {
  /**
   * Micro burst - 8 particles at a specific position
   * Used for card selections and interactions
   */
  microBurst: (x: number, y: number) => {
    confetti({
      particleCount: 8,
      spread: 40,
      origin: { x, y },
      scalar: 0.8,
      gravity: 1.2,
      ticks: 60,
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF']
    });
  },

  /**
   * Celebration - 3-second multi-burst from sides
   * Used for final success screen
   */
  celebration: () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Left side burst
      confetti({
        particleCount,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { x: 0, y: 0.6 },
        colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94']
      });
      
      // Right side burst
      confetti({
        particleCount,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { x: 1, y: 0.6 },
        colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94']
      });
    }, 250);
  },

  /**
   * Single burst - 100 particles from center
   * Used for immediate celebrations
   */
  singleBurst: () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94']
    });
  },

  /**
   * Gold sparkle - 30 premium gold/white particles from top-center
   * Used for mid-assessment milestone transition overlay
   */
  goldSparkle: () => {
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { x: 0.5, y: 0.25 },
      colors: ['#FFD700', '#FFFFFF', '#FFF8DC', '#F0E68C'],
      scalar: 0.9,
      gravity: 1.0,
      ticks: 80,
    });
  }
};
