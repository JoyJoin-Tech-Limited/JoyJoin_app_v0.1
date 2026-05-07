import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface WhyThisTableProps {
  explanation: string;
}

export default function WhyThisTable({ explanation }: WhyThisTableProps) {
  if (!explanation) {
    return null;
  }
  
  return (
    <div className="space-y-3" data-testid="section-why-this-table">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        为什么是这桌？
      </h3>
      
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-sm leading-relaxed" data-testid="text-match-explanation">
            {explanation}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
