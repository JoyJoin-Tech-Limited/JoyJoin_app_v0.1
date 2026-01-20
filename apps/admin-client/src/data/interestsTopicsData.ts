/**
 * ⚠️ STUB FILE FOR LEGACY COMPATIBILITY
 * 
 * This file provides minimal type-safe stubs for legacy backup modules
 * that reference the old interest/topic system.
 * 
 * New code should use @shared/interests instead.
 */

import { getInterestLabel as sharedGetInterestLabel } from "@shared/interests";

export interface InterestOption {
  id: string;
  label: string;
}

export interface TopicGroup {
  id: string;
  label: string;
  topics: Array<{ id: string; label: string }>;
}

// Empty arrays for legacy compatibility
export const INTERESTS_OPTIONS: InterestOption[] = [];
export const TOPICS_GROUPS: TopicGroup[] = [];

export function getAllTopics(): Array<{ id: string; label: string }> {
  return [];
}

export function getInterestLabel(id: string): string {
  return sharedGetInterestLabel(id);
}

export function getTopicLabel(id: string): string {
  // Topics are free-form strings, return as-is
  return id;
}
