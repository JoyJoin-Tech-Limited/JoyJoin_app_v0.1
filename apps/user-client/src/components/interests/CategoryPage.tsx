import { forwardRef } from "react";
import { InterestBubble } from "./InterestBubble";
import type { InterestCategory, HeatLevel } from "@/data/interestCarouselData";

interface CategoryPageProps {
  category: InterestCategory;
  selections: Record<string, HeatLevel>;
  onTopicTap: (topicId: string) => void;
}

export const CategoryPage = forwardRef<HTMLDivElement, CategoryPageProps>(
  ({ category, selections, onTopicTap }, ref) => {
    return (
      <div className="w-full" ref={ref}>
        {/* Sticky category header - positioned below tab bar */}
        <div className="sticky top-[154px] bg-background/95 backdrop-blur-sm z-10 px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{category.emoji}</span>
            <h3 className="text-sm font-bold">{category.name}</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {Object.keys(selections).filter(id => 
                category.topics.some(t => t.id === id) && selections[id] > 0
              ).length}/{category.topics.length}
            </span>
          </div>
        </div>

        {/* 3-column grid layout for better touch targets (44x44dp minimum) */}
        <div className="grid grid-cols-3 gap-2 px-3 py-3">
          {category.topics.map((topic) => (
            <InterestBubble
              key={topic.id}
              topic={topic}
              level={selections[topic.id] || 0}
              onTap={() => onTopicTap(topic.id)}
            />
          ))}
        </div>
      </div>
    );
  }
);

CategoryPage.displayName = "CategoryPage";
