import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  "data-testid"?: string;
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

export function MultiSelectButton({
  selected,
  onClick,
  children,
  disabled = false,
  className,
  icon,
  "data-testid": testId,
}: MultiSelectButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    triggerHaptic();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm min-h-[44px]",
        "transition-all duration-150 ease-out",
        "active:scale-[0.97]",
        selected
          ? "border-primary bg-primary text-primary-foreground font-medium shadow-sm"
          : disabled
          ? "border-muted bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
          : "border-muted bg-muted/30 hover-elevate",
        className
      )}
      data-testid={testId}
    >
      {selected && (
        <Check className="h-4 w-4 flex-shrink-0" />
      )}
      {!selected && icon && (
        <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      )}
      {selected && icon && (
        <span className="flex-shrink-0">{icon}</span>
      )}
      <span className={cn(!selected && icon ? "" : selected ? "" : "")}>{children}</span>
    </button>
  );
}

interface MultiSelectGroupProps {
  label: string;
  hint?: string;
  selectedCount?: number;
  maxCount?: number;
  showCounter?: boolean;
  children: ReactNode;
}

export function MultiSelectGroup({
  label,
  hint,
  selectedCount = 0,
  maxCount,
  showCounter = true,
  children,
}: MultiSelectGroupProps) {
  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold">{label}</h4>
          {showCounter && selectedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              已选 {selectedCount}{maxCount ? `/${maxCount}` : ''}
            </span>
          )}
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

interface SingleSelectButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function SingleSelectButton({
  selected,
  onClick,
  children,
  disabled = false,
  className,
  "data-testid": testId,
}: SingleSelectButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    triggerHaptic();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm min-h-[44px]",
        "transition-all duration-150 ease-out",
        "active:scale-[0.97]",
        selected
          ? "border-primary bg-primary text-primary-foreground font-medium shadow-sm"
          : disabled
          ? "border-muted bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
          : "border-muted bg-muted/30 hover-elevate",
        className
      )}
      data-testid={testId}
    >
      <div className={cn(
        "h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
        selected ? "border-primary-foreground bg-primary-foreground" : "border-current opacity-50"
      )}>
        {selected && (
          <div className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>
      <span>{children}</span>
    </button>
  );
}
