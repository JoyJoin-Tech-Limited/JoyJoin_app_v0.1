import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface BirthDatePickerProps {
  value?: { year: number; month: number; day: number };
  onChange: (date: { year: number; month: number; day: number }) => void;
  className?: string;
  /** Minimum year allowed (default: 1900) */
  minYear?: number;
  /** Maximum year allowed (default: current year) */
  maxYear?: number;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface WheelSelectorProps {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  label: string;
  ariaLabel: string;
  id: string;
}

function WheelSelector({
  values,
  selected,
  onSelect,
  label,
  ariaLabel,
  id,
}: WheelSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastHapticValueRef = useRef<number>(selected);
  const itemHeight = 44; // 44pt as per spec
  const visibleItems = 5;
  
  const selectedIndex = values.indexOf(selected);
  
  // Initial scroll to selected value
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      const scrollPosition = selectedIndex * itemHeight - (itemHeight * Math.floor(visibleItems / 2));
      containerRef.current.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'auto'
      });
    }
  }, []);

  // Haptic feedback on snap
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10); // Light haptic
    }
  }, []);

  // Handle scroll with debounce and snap
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll events
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const centerIndex = Math.round((scrollTop + itemHeight * Math.floor(visibleItems / 2)) / itemHeight);
      const clampedIndex = Math.min(Math.max(0, centerIndex), values.length - 1);
      const newValue = values[clampedIndex];
      
      if (newValue !== undefined && newValue !== selected) {
        // Trigger haptic only if value actually changed
        if (newValue !== lastHapticValueRef.current) {
          triggerHaptic();
          lastHapticValueRef.current = newValue;
        }
        
        onSelect(newValue);
        
        // Snap to center with smooth animation (120-180ms as per spec)
        const targetScroll = clampedIndex * itemHeight - (itemHeight * Math.floor(visibleItems / 2));
        containerRef.current.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    }, 50); // 50ms debounce
  }, [values, selected, onSelect, triggerHaptic, itemHeight, visibleItems]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center flex-1">
      {/* Column header */}
      <span className="text-sm font-medium text-foreground mb-3" id={`${id}-label`}>
        {label}
      </span>
      
      <div className="relative w-full">
        {/* Top gradient mask */}
        <div className="absolute top-0 left-0 right-0 h-11 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
        
        {/* Selection line indicator */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-11 border-y border-border/50 pointer-events-none z-10" />
        
        {/* Scrollable wheel */}
        <div 
          ref={containerRef}
          role="listbox"
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-${selected}`}
          tabIndex={0}
          className={cn(
            "relative h-[220px] overflow-y-auto snap-y snap-mandatory",
            "scrollbar-hide scroll-smooth",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
          )}
          onScroll={handleScroll}
          onKeyDown={(event) => {
            const { key } = event;

            if (key === "ArrowUp" || key === "ArrowDown") {
              event.preventDefault();

              const currentIndex = values.indexOf(selected);
              if (currentIndex === -1) {
                return;
              }

              const delta = key === "ArrowUp" ? -1 : 1;
              const nextIndex = Math.min(
                Math.max(0, currentIndex + delta),
                values.length - 1
              );

              const nextValue = values[nextIndex];
              if (nextValue == null || nextValue === selected) {
                return;
              }

              onSelect(nextValue);
              triggerHaptic();

              const targetScroll =
                nextIndex * itemHeight -
                itemHeight * Math.floor(visibleItems / 2);

              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: Math.max(0, targetScroll),
                  behavior: "smooth",
                });
              }

              return;
            }

            if (key === "ArrowLeft" || key === "ArrowRight") {
              event.preventDefault();

              if (!containerRef.current) {
                return;
              }

              const listboxes = Array.from(
                document.querySelectorAll<HTMLElement>('[role="listbox"]')
              );
              const currentIndex = listboxes.indexOf(containerRef.current);

              if (currentIndex === -1) {
                return;
              }

              const nextIndex =
                key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;

              if (nextIndex < 0 || nextIndex >= listboxes.length) {
                return;
              }

              listboxes[nextIndex].focus();
            }
          }}
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {/* Spacer top */}
          <div style={{ height: itemHeight * Math.floor(visibleItems / 2) }} />
          
          {values.map((value) => {
            const isSelected = value === selected;
            return (
              <div
                key={value}
                id={`${id}-${value}`}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "flex items-center justify-center cursor-pointer snap-center transition-all duration-150 ease-out",
                  isSelected 
                    ? "text-primary font-semibold scale-105" 
                    : "text-muted-foreground opacity-70"
                )}
                style={{ 
                  height: `${itemHeight}px`,
                  fontSize: isSelected ? '18px' : '16px',
                  lineHeight: `${itemHeight}px`
                }}
                onClick={() => {
                  onSelect(value);
                  triggerHaptic();
                  // Scroll to center this item
                  const targetIndex = values.indexOf(value);
                  const targetScroll = targetIndex * itemHeight - (itemHeight * Math.floor(visibleItems / 2));
                  if (containerRef.current) {
                    containerRef.current.scrollTo({
                      top: Math.max(0, targetScroll),
                      behavior: 'smooth'
                    });
                  }
                }}
              >
                {value}
              </div>
            );
          })}
          
          {/* Spacer bottom */}
          <div style={{ height: itemHeight * Math.floor(visibleItems / 2) }} />
        </div>
        
        {/* Bottom gradient mask */}
        <div className="absolute bottom-0 left-0 right-0 h-11 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}

/**
 * BirthDatePicker - Mobile-first three-wheel date selector
 * 
 * Features:
 * - Inertial scroll with snap-to-row behavior
 * - Haptic feedback on value change
 * - Gradient masks for visual depth
 * - Accessible with screen reader support
 * - Automatic leap year and day validation
 * - Prevents future dates
 * - AA contrast for selected/unselected states
 */
export function BirthDatePicker({
  value,
  onChange,
  className,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
}: BirthDatePickerProps) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  
  // Ensure maxYear doesn't exceed current year (no future dates)
  const effectiveMaxYear = Math.min(maxYear, currentYear);
  
  // Default to reasonable median or previous value
  const defaultYear = value?.year || 1995;
  const defaultMonth = value?.month || 6;
  const defaultDay = value?.day || 15;
  
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [day, setDay] = useState(defaultDay);
  
  // Generate year array (reversed, newest first)
  const years = Array.from(
    { length: effectiveMaxYear - minYear + 1 }, 
    (_, i) => effectiveMaxYear - i
  );
  
  // Generate days based on selected year and month
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  // Adjust day if it exceeds days in month (leap year and month-end handling)
  useEffect(() => {
    if (day > daysInMonth) {
      const oldDay = day;
      setDay(daysInMonth);
      
      // Show toast for invalid day transitions
      toast({
        description: `日期已自动调整：${oldDay}日 → ${daysInMonth}日`,
        duration: 2000,
      });
    }
  }, [daysInMonth, day, toast]);

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  // Notify parent of changes
  useEffect(() => {
    onChangeRef.current({ year, month, day: Math.min(day, daysInMonth) });
  }, [year, month, day, daysInMonth]);

  const age = currentYear - year;

  return (
    <div className={cn("flex flex-col items-center gap-6 py-4", className)}>
      {/* Three-column picker with headers */}
      <div className="flex gap-4 justify-center w-full max-w-sm px-4">
        <WheelSelector
          values={years}
          selected={year}
          onSelect={setYear}
          label="年"
          ariaLabel="年份选择器"
          id="year-picker"
        />
        
        <WheelSelector
          values={MONTHS}
          selected={month}
          onSelect={setMonth}
          label="月"
          ariaLabel="月份选择器"
          id="month-picker"
        />
        
        <WheelSelector
          values={days}
          selected={day}
          onSelect={setDay}
          label="日"
          ariaLabel="日期选择器"
          id="day-picker"
        />
      </div>
      
      {/* Selected date display */}
      <div className="text-center">
        <p className="text-lg font-semibold text-primary">
          {year}年{month}月{day}日
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {age}岁
        </p>
      </div>
    </div>
  );
}

export default BirthDatePicker;
