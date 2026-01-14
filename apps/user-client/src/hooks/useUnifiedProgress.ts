/**
 * useUnifiedProgress - Hook for unified progress tracking across flows
 * 
 * Features:
 * - Milestone detection (25%, 50%, 75%)
 * - Unified progress calculation
 * - Support for Endowed Progress Effect
 * - Goal Gradient Effect
 */

import { useState, useCallback, useRef, useEffect } from "react";

const MILESTONES = [25, 50, 75];
const MILESTONE_THRESHOLD = 2; // Within 2% of milestone

export interface UnifiedProgressOptions {
  /** Callback when milestone is reached */
  onMilestone?: (milestone: number) => void;
  /** Duration to keep milestone state active (ms) */
  milestoneDuration?: number;
}

export function useUnifiedProgress(options: UnifiedProgressOptions = {}) {
  const { onMilestone, milestoneDuration = 600 } = options;
  
  const [milestoneReached, setMilestoneReached] = useState(false);
  const lastMilestoneRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  /**
   * Detect if progress has crossed a milestone
   */
  const detectMilestone = useCallback((progress: number) => {
    const roundedProgress = Math.round(progress);
    
    // Find the milestone we just reached or passed
    // We want to trigger when: progress >= milestone AND progress < milestone + threshold
    const currentMilestone = MILESTONES.find(m => 
      roundedProgress >= m && 
      roundedProgress < m + MILESTONE_THRESHOLD
    );
    
    // Only trigger if we haven't already triggered for this milestone
    if (currentMilestone && currentMilestone !== lastMilestoneRef.current) {
      lastMilestoneRef.current = currentMilestone;
      setMilestoneReached(true);
      
      // Trigger callback
      onMilestone?.(currentMilestone);
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Reset milestone state after duration
      timeoutRef.current = setTimeout(() => {
        setMilestoneReached(false);
      }, milestoneDuration);
    }
  }, [onMilestone, milestoneDuration]);
  
  /**
   * Calculate unified progress across onboarding + assessment flow
   * 
   * Journey breakdown:
   * - 8 Anchor Questions (pre-login): 0% → 50%
   * - Login screen: 50% → 55%
   * - 0-8 Additional Questions (post-login): 55% → 100%
   */
  const getUnifiedProgress = useCallback((
    context: 'onboarding' | 'assessment',
    answeredCount: number,
    estimatedRemaining: number
  ): number => {
    const ONBOARDING_WEIGHT = 0.5;  // 50% for pre-login anchors
    const LOGIN_WEIGHT = 0.05;       // 5% for login
    const ASSESSMENT_WEIGHT = 0.45;  // 45% for post-login
    
    if (context === 'onboarding') {
      // Pre-login: 8 anchor questions → 0% to 50%
      const anchorProgress = Math.min(answeredCount / 8, 1.0);
      return anchorProgress * ONBOARDING_WEIGHT * 100;
    }
    
    if (context === 'assessment') {
      // Post-login: Start at 55% (50% anchors + 5% login)
      const baseProgress = ONBOARDING_WEIGHT + LOGIN_WEIGHT;
      
      // Calculate progress for remaining questions
      // answeredCount includes the 8 anchor questions
      const additionalAnswered = Math.max(0, answeredCount - 8);
      const totalAdditionalQuestions = additionalAnswered + estimatedRemaining;
      
      // Avoid division by zero
      if (totalAdditionalQuestions === 0) {
        return baseProgress * 100;
      }
      
      const assessmentProgress = Math.min(additionalAnswered / totalAdditionalQuestions, 1.0);
      
      return (baseProgress + assessmentProgress * ASSESSMENT_WEIGHT) * 100;
    }
    
    return 0;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    /** Whether a milestone was just reached */
    milestoneReached,
    /** Detect milestone crossing */
    detectMilestone,
    /** Calculate unified progress */
    getUnifiedProgress,
  };
}
