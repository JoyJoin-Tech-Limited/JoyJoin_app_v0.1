import { forwardRef, useMemo } from "react";
import { InterestBubble } from "./InterestBubble";
import type { InterestCategory, HeatLevel } from "@/data/interestCarouselData";
import { isRecommendedForArchetype } from "@/lib/archetypeInterestRecommendations";

interface CategoryPageProps {
  category: InterestCategory;
  selections: Record<string, HeatLevel>;
  onTopicTap: (topicId: string) => void;
  archetypeId?: string | null;
}

export const CategoryPage = forwardRef<HTMLDivElement, CategoryPageProps>(
  ({ category, selections, onTopicTap, archetypeId }, ref) => {
    // Pre-compute which topics are recommended (O(n) once per category render).
    // The Set is reused both for sorting and for rendering badges, avoiding
    // redundant array searches.
    const { sortedTopics, recommendedIds } = useMemo(() => {
      if (!archetypeId) {
        return { sortedTopics: category.topics, recommendedIds: new Set<string>() };
      }
      const ids = new Set(
        category.topics
          .filter((t) => isRecommendedForArchetype(t.id, archetypeId))
          .map((t) => t.id)
      );
      const sorted = [...category.topics].sort((a, b) => {
        const aRec = ids.has(a.id) ? 0 : 1;
        const bRec = ids.has(b.id) ? 0 : 1;
        return aRec - bRec;
      });
      return { sortedTopics: sorted, recommendedIds: ids };
    }, [category.topics, archetypeId]);

    return (
      <div className="w-full" ref={ref} id={`category-panel-${category.id}`}>
        {/* Category header - not sticky, just a regular header */}
        <div className="bg-background/95 backdrop-blur-sm px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label={category.name}>{category.emoji}</span>
            <h3 className="text-sm font-bold">{category.name}</h3>
            <span className="ml-auto text-xs text-muted-foreground" aria-label={`已选择 ${Object.keys(selections).filter(id => 
                category.topics.some(t => t.id === id) && selections[id] > 0
              ).length} 个，共 ${category.topics.length} 个兴趣`}>
              {Object.keys(selections).filter(id => 
                category.topics.some(t => t.id === id) && selections[id] > 0
              ).length}/{category.topics.length}
            </span>
          </div>
        </div>

        {/* 3-column grid layout for better touch targets (44x44dp minimum) */}
        <div 
          className="grid grid-cols-3 gap-2 px-3 py-3"
          role="group"
          aria-label={`${category.name} 兴趣选项`}
        >
          {sortedTopics.map((topic) => (
            <InterestBubble
              key={topic.id}
              topic={topic}
              level={selections[topic.id] || 0}
              onTap={() => onTopicTap(topic.id)}
              isRecommended={recommendedIds.has(topic.id)}
            />
          ))}
        </div>
      </div>
    );
  }
);

CategoryPage.displayName = "CategoryPage";
