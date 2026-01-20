import { InterestBubble } from "./InterestBubble";
import type { InterestCategory, HeatLevel } from "@/data/interestCarouselData";

interface CategoryPageProps {
  category: InterestCategory;
  selections: Record<string, HeatLevel>;
  onTopicTap: (topicId: string) => void;
}

export function CategoryPage({ category, selections, onTopicTap }: CategoryPageProps) {
  return (
    <div className="w-full">
      {/* Sticky category header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 px-3 py-2 border-b">
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

      {/* 4-column grid layout */}
      <div className="grid grid-cols-4 gap-1.5 px-2 py-3">
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
