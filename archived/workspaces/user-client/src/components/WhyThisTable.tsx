import { XiaoyueInsightCard } from "@/components/XiaoyueInsightCard";

interface WhyThisTableProps {
  explanation: string;
}

export default function WhyThisTable({ explanation }: WhyThisTableProps) {
  if (!explanation) {
    return null;
  }
  
  return (
    <div className="space-y-3" data-testid="section-why-this-table">
      <XiaoyueInsightCard
        title="为什么是这桌？"
        content={explanation}
        pose="thinking"
        tone="confident"
        badgeText="小悦分析"
        avatarSize="md"
      />
    </div>
  );
}
