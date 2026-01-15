import { InterestBubble } from "./InterestBubble";
import type { InterestCategory, HeatLevel } from "@/data/interestCarouselData";

interface CategoryPageProps {
  category: InterestCategory;
  selections: Record<string, HeatLevel>;
  onTopicTap: (topicId: string) => void;
}

export function CategoryPage({ category, selections, onTopicTap }: CategoryPageProps) {
  return (
    <div className="w-full h-full flex flex-col px-4 py-6">
      {/* Category header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{category.emoji}</div>
        <h2 className="text-xl font-bold">{category.name}</h2>
      </div>

      {/* 2x5 grid layout */}
      <div className="grid grid-cols-2 gap-3 flex-1 content-start">
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
