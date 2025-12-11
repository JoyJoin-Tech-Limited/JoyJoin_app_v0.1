import { storage } from "./storage";

/**
 * Venue Matching Service
 * 
 * Intelligently selects appropriate venues for events based on:
 * - Event type and theme
 * - Participant count
 * - Location preferences
 * - Cuisine preferences (for dining events)
 * - Venue capacity and availability
 */

export interface VenueMatchingCriteria {
  eventType: string;
  theme?: string;
  participantCount: number;
  preferredDistrict?: string;
  preferredCity?: string;
  cuisinePreferences?: string[];
  priceRange?: string;
  dateTime?: Date;
}

export interface VenueMatchResult {
  venue: any;
  matchScore: number;
  reasons: string[];
}

export class VenueMatchingService {
  /**
   * Find the best matching venues for an event
   * Returns top 5 venues sorted by match score
   */
  async findMatchingVenues(criteria: VenueMatchingCriteria): Promise<VenueMatchResult[]> {
    const allVenues = await storage.getAllVenues();
    
    // Filter only active venues
    const activeVenues = allVenues.filter(v => v.isActive);
    
    if (activeVenues.length === 0) {
      console.warn("[VenueMatching] No active venues available");
      return [];
    }
    
    // Score each venue
    const scoredVenues = activeVenues.map(venue => {
      const { score, reasons } = this.calculateVenueScore(venue, criteria);
      return {
        venue,
        matchScore: score,
        reasons,
      };
    });
    
    // Sort by score (highest first) and return top 5
    const topVenues = scoredVenues
      .filter(v => v.matchScore > 0) // Only return venues with positive scores
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
    
    console.log(`[VenueMatching] Found ${topVenues.length} matching venues for ${criteria.eventType} with ${criteria.participantCount} participants`);
    
    return topVenues;
  }
  
  /**
   * Calculate match score for a single venue
   * Score range: 0-100
   */
  private calculateVenueScore(venue: any, criteria: VenueMatchingCriteria): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    
    // 1. Event type match (20 points)
    const eventTypeMatch = this.matchEventType(venue.type, criteria.eventType);
    if (eventTypeMatch.matches) {
      score += 20;
      reasons.push(eventTypeMatch.reason);
    } else {
      // If event type doesn't match at all, return low score
      return { score: 5, reasons: ["场地类型不太匹配"] };
    }
    
    // 2. Capacity match (25 points)
    const capacityMatch = this.matchCapacity(venue, criteria.participantCount);
    score += capacityMatch.score;
    if (capacityMatch.reason) {
      reasons.push(capacityMatch.reason);
    }
    
    // 3. Location match (20 points)
    const locationMatch = this.matchLocation(venue, criteria);
    score += locationMatch.score;
    if (locationMatch.reason) {
      reasons.push(locationMatch.reason);
    }
    
    // 4. Cuisine match (15 points) - only for dining events
    if (criteria.eventType === "dining" && criteria.cuisinePreferences && criteria.cuisinePreferences.length > 0) {
      const cuisineMatch = this.matchCuisine(venue, criteria.cuisinePreferences);
      score += cuisineMatch.score;
      if (cuisineMatch.reason) {
        reasons.push(cuisineMatch.reason);
      }
    } else if (criteria.eventType === "dining") {
      score += 10; // Partial points if no cuisine preference specified
    }
    
    // 5. Price range match (10 points)
    if (criteria.priceRange) {
      const priceMatch = this.matchPriceRange(venue, criteria.priceRange);
      score += priceMatch.score;
      if (priceMatch.reason) {
        reasons.push(priceMatch.reason);
      }
    } else {
      score += 5; // Partial points if no price preference
    }
    
    // 6. Availability bonus (10 points)
    // Check if venue has capacity for concurrent events
    if (venue.maxConcurrentEvents > 1) {
      score += 10;
      reasons.push("场地可同时举办多场活动");
    } else {
      score += 5;
    }
    
    return { score: Math.min(100, score), reasons };
  }
  
  /**
   * Match event type to venue type
   */
  private matchEventType(venueType: string, eventType: string): { matches: boolean; reason: string } {
    const typeMapping: Record<string, string[]> = {
      restaurant: ["dining", "networking", "social"],
      cafe: ["casual", "networking", "creative", "social"],
      bar: ["social", "networking", "entertainment"],
      workspace: ["professional", "creative", "workshop", "networking"],
      studio: ["creative", "workshop", "fitness", "wellness"],
      outdoor: ["sports", "adventure", "wellness"],
      venue: ["entertainment", "cultural", "workshop"],
    };
    
    const compatibleTypes = typeMapping[venueType] || [];
    const matches = compatibleTypes.includes(eventType);
    
    if (matches) {
      return { matches: true, reason: `适合${this.getEventTypeLabel(eventType)}活动` };
    }
    
    return { matches: false, reason: "场地类型不匹配" };
  }
  
  /**
   * Match participant count to venue capacity
   */
  private matchCapacity(venue: any, participantCount: number): { score: number; reason?: string } {
    // Most venues should handle 5-10 people comfortably
    // We want venues that can handle the group but aren't too large
    
    if (participantCount <= 10) {
      // Perfect for small groups (blind box events are typically 5-10 people)
      return { score: 25, reason: "容量完美适配小型聚会" };
    } else if (participantCount <= 15) {
      return { score: 20, reason: "可容纳中小型团体" };
    } else if (participantCount <= 20) {
      return { score: 15, reason: "适合中型活动" };
    } else {
      return { score: 10, reason: "可容纳较大型活动" };
    }
  }
  
  /**
   * Match location preferences
   */
  private matchLocation(venue: any, criteria: VenueMatchingCriteria): { score: number; reason?: string } {
    let score = 0;
    let reason = "";
    
    // City match (10 points)
    if (criteria.preferredCity && venue.city === criteria.preferredCity) {
      score += 10;
      reason = `位于${venue.city}`;
    } else if (criteria.preferredCity) {
      score += 3; // Partial points for different city
    } else {
      score += 5; // No preference specified
    }
    
    // District match (10 points)
    if (criteria.preferredDistrict && venue.district === criteria.preferredDistrict) {
      score += 10;
      reason = reason ? `${reason}${venue.district}区` : `位于${venue.district}区`;
    } else if (criteria.preferredDistrict) {
      score += 3; // Partial points for different district
    } else {
      score += 5; // No preference specified
    }
    
    return { score, reason };
  }
  
  /**
   * Match cuisine preferences for dining events
   */
  private matchCuisine(venue: any, cuisinePreferences: string[]): { score: number; reason?: string } {
    if (!venue.cuisines || venue.cuisines.length === 0) {
      return { score: 5, reason: undefined }; // Partial points if venue has no cuisine tags
    }
    
    const matchingCuisines = venue.cuisines.filter((c: string) => 
      cuisinePreferences.includes(c)
    );
    
    if (matchingCuisines.length > 0) {
      const score = Math.min(15, matchingCuisines.length * 7);
      return { 
        score, 
        reason: `提供${matchingCuisines.join("、")}料理` 
      };
    }
    
    return { score: 3, reason: undefined }; // Small points for having cuisine data even if no match
  }
  
  /**
   * Match price range
   */
  private matchPriceRange(venue: any, preferredRange: string): { score: number; reason?: string } {
    if (!venue.priceRange) {
      return { score: 5, reason: undefined };
    }
    
    if (venue.priceRange === preferredRange) {
      return { score: 10, reason: `价格区间${this.getPriceRangeLabel(preferredRange)}` };
    }
    
    // Adjacent price ranges get partial points
    const ranges = ["budget", "moderate", "upscale", "luxury"];
    const preferredIndex = ranges.indexOf(preferredRange);
    const venueIndex = ranges.indexOf(venue.priceRange);
    
    if (Math.abs(preferredIndex - venueIndex) === 1) {
      return { score: 5, reason: undefined };
    }
    
    return { score: 2, reason: undefined };
  }
  
  /**
   * Get user-friendly event type label
   */
  private getEventTypeLabel(eventType: string): string {
    const labels: Record<string, string> = {
      dining: "美食",
      networking: "社交",
      casual: "休闲",
      creative: "创意",
      professional: "专业",
      workshop: "工作坊",
      fitness: "健身",
      wellness: "养生",
      sports: "运动",
      adventure: "探险",
      entertainment: "娱乐",
      cultural: "文化",
      social: "社交",
    };
    
    return labels[eventType] || eventType;
  }
  
  /**
   * Get user-friendly price range label
   */
  private getPriceRangeLabel(priceRange: string): string {
    const labels: Record<string, string> = {
      budget: "经济实惠",
      moderate: "中等价位",
      upscale: "高档",
      luxury: "奢华",
    };
    
    return labels[priceRange] || priceRange;
  }
  
  /**
   * Select the best venue for an event (returns single venue)
   */
  async selectBestVenue(criteria: VenueMatchingCriteria): Promise<VenueMatchResult | null> {
    const matches = await this.findMatchingVenues(criteria);
    
    if (matches.length === 0) {
      console.warn("[VenueMatching] No suitable venues found for criteria");
      return null;
    }
    
    return matches[0]; // Return the highest-scoring venue
  }
}

export const venueMatchingService = new VenueMatchingService();
