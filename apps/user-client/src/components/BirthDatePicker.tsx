import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BirthDatePickerProps {
  value?: { year: number; month: number; day: number };
  onChange: (date: { year: number; month: number; day: number }) => void;
  className?: string;
  /** Minimum year allowed */
  minYear?: number;
  /** Maximum year allowed */
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
  suffix: string;
  /** Show decade jump buttons */
  showDecadeJump?: boolean;
  onDecadeJump?: (delta: number) => void;
}

function WheelSelector({
  values,
  selected,
  onSelect,
  label,
  suffix,
  showDecadeJump = false,
  onDecadeJump,
}: WheelSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 48;
  const visibleItems = 5;
  
  // Find the index of the selected value
  const selectedIndex = values.indexOf(selected);
  
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      const scrollPosition = selectedIndex * itemHeight - (itemHeight * Math.floor(visibleItems / 2));
      containerRef.current.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [selected, selectedIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const centerIndex = Math.round((scrollTop + itemHeight * Math.floor(visibleItems / 2)) / itemHeight);
    const newValue = values[Math.min(Math.max(0, centerIndex), values.length - 1)];
    if (newValue !== undefined && newValue !== selected) {
      onSelect(newValue);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground mb-2">{label}</span>
      
      {showDecadeJump && onDecadeJump && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mb-1"
          onClick={() => onDecadeJump(10)}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}
      
      <div 
        ref={containerRef}
        className={cn(
          "relative h-[240px] w-24 overflow-y-auto snap-y snap-mandatory",
          "scrollbar-hide scroll-smooth",
          "border rounded-xl bg-card"
        )}
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* Spacer top */}
        <div style={{ height: itemHeight * Math.floor(visibleItems / 2) }} />
        
        {values.map((value, index) => {
          const isSelected = value === selected;
          return (
            <div
              key={value}
              className={cn(
                "flex items-center justify-center h-12 cursor-pointer snap-center",
                "transition-all duration-200",
                isSelected 
                  ? "text-primary font-bold text-xl scale-110" 
                  : "text-muted-foreground text-base opacity-60 hover:opacity-80"
              )}
              onClick={() => onSelect(value)}
            >
              {value}{suffix}
            </div>
          );
        })}
        
        {/* Spacer bottom */}
        <div style={{ height: itemHeight * Math.floor(visibleItems / 2) }} />
      </div>
      
      {showDecadeJump && onDecadeJump && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mt-1"
          onClick={() => onDecadeJump(-10)}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * BirthDatePicker - Three-wheel date selector component
 * 
 * Provides a mobile-friendly date picker with:
 * - Year/Month/Day wheels
 * - Decade jump buttons for quick year selection
 * - Bounded ranges
 * - Auto-adjusting days based on month/year
 */
export function BirthDatePicker({
  value,
  onChange,
  className,
  minYear = 1960,
  maxYear = 2010,
}: BirthDatePickerProps) {
  const currentYear = new Date().getFullYear();
  const defaultYear = value?.year || 1995;
  const defaultMonth = value?.month || 1;
  const defaultDay = value?.day || 1;
  
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [day, setDay] = useState(defaultDay);
  
  // Generate year array
  const years = Array.from(
    { length: maxYear - minYear + 1 }, 
    (_, i) => maxYear - i
  );
  
  // Generate days based on selected year and month
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  // Adjust day if it exceeds days in month
  useEffect(() => {
    if (day > daysInMonth) {
      setDay(daysInMonth);
    }
  }, [daysInMonth, day]);
  
  // Notify parent of changes
  useEffect(() => {
    onChange({ year, month, day: Math.min(day, daysInMonth) });
  }, [year, month, day, daysInMonth, onChange]);

  const handleDecadeJump = (delta: number) => {
    const newYear = Math.max(minYear, Math.min(maxYear, year + delta));
    setYear(newYear);
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>选择出生日期</span>
      </div>
      
      <div className="flex gap-4 justify-center">
        <WheelSelector
          values={years}
          selected={year}
          onSelect={setYear}
          label="年"
          suffix="年"
          showDecadeJump
          onDecadeJump={handleDecadeJump}
        />
        
        <WheelSelector
          values={MONTHS}
          selected={month}
          onSelect={setMonth}
          label="月"
          suffix="月"
        />
        
        <WheelSelector
          values={days}
          selected={day}
          onSelect={setDay}
          label="日"
          suffix="日"
        />
      </div>
      
      <div className="text-center">
        <p className="text-lg font-medium text-primary">
          {year}年{month}月{day}日
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {currentYear - year}岁
        </p>
      </div>
    </div>
  );
}

export default BirthDatePicker;
