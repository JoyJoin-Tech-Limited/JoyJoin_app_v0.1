import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

interface InfoField {
  label: string;
  value: string | string[] | null | undefined;
  type?: "text" | "badge-list";
  placeholder?: string;
}

interface UserInfoCardProps {
  title: string;
  icon?: ReactNode;
  fields: InfoField[];
  editable?: boolean;
  onEdit?: () => void;
  className?: string;
}

export default function UserInfoCard({
  title,
  icon,
  fields,
  editable = false,
  onEdit,
  className = "",
}: UserInfoCardProps) {
  const renderValue = (field: InfoField) => {
    // Handle empty values
    if (!field.value || (Array.isArray(field.value) && field.value.length === 0)) {
      return (
        <span className="text-muted-foreground text-sm">
          {field.placeholder || "未填写"}
        </span>
      );
    }

    // Handle badge list (arrays)
    if (field.type === "badge-list" && Array.isArray(field.value)) {
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {field.value.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      );
    }

    // Handle text values
    return (
      <span className="text-foreground text-sm">
        {Array.isArray(field.value) ? field.value.join("、") : field.value}
      </span>
    );
  };

  return (
    <Card 
      className={`${className} ${editable ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
      onClick={editable && onEdit ? onEdit : undefined}
      data-testid={`card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </CardTitle>
        {editable && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{field.label}</span>
            {renderValue(field)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
