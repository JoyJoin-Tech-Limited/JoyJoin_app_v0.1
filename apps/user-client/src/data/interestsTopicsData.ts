/**
 * Legacy compatibility file for interestsTopicsData
 * This file provides compatibility functions for the old interests topics system.
 * The new system uses interestCarouselData.ts
 */

import { getTopicById, INTEREST_CATEGORIES } from "./interestCarouselData";

// Type definitions for legacy compatibility
export interface InterestOption {
  id: string;
  label: string;
}

export interface TopicGroup {
  id: string;
  label: string;
  topics: Array<{ id: string; label: string }>;
}

// Empty arrays for legacy backup modules compatibility
export const INTERESTS_OPTIONS: InterestOption[] = [];
export const TOPICS_GROUPS: TopicGroup[] = [];

export function getAllTopics(): Array<{ id: string; label: string }> {
  return [];
}

/**
 * Get interest category label by ID
 */
export function getInterestLabel(id: string): string {
  const category = INTEREST_CATEGORIES.find(cat => cat.id === id);
  return category?.name || id;
}

/**
 * Get topic label by ID
 */
export function getTopicLabel(id: string): string {
  const topic = getTopicById(id);
  return topic?.label || id;
}

// Stub for legacy backup modules that reference getInterestIcon
export function getInterestIcon(_id: string): string {
  return "";
}
