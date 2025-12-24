import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface SlidingTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (value: string) => void;
}

export default function SlidingTabs({ tabs, activeTab, onTabChange }: SlidingTabsProps) {
  const [sliderStyle, setSliderStyle] = useState({ width: 0, left: 0 });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeIndex = tabs.findIndex(tab => tab.value === activeTab);
    const activeTabElement = tabRefs.current[activeIndex];
    
    if (activeTabElement && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();
      
      setSliderStyle({
        width: tabRect.width,
        left: tabRect.left - containerRect.left,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div 
      ref={containerRef}
      className="relative flex bg-muted/40 rounded-xl p-1.5 mx-4 mt-4 mb-2"
      data-testid="sliding-tabs-container"
    >
      {/* Animated Slider */}
      <motion.div
        className="absolute top-1.5 bottom-1.5 bg-primary rounded-lg shadow-lg"
        style={{
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
        }}
        initial={false}
        animate={{
          width: sliderStyle.width,
          left: sliderStyle.left,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
      />

      {/* Tab Items */}
      {tabs.map((tab, index) => {
        const isActive = tab.value === activeTab;
        
        return (
          <button
            key={tab.value}
            ref={(el) => (tabRefs.current[index] = el)}
            onClick={() => onTabChange(tab.value)}
            className={`
              relative flex-1 z-10 py-3 px-2 rounded-lg text-sm font-medium
              transition-all duration-200 ease-out
              ${isActive 
                ? 'text-primary-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
              active:scale-[0.98]
            `}
            data-testid={`tab-${tab.value}`}
          >
            <span className="flex items-center justify-center gap-1">
              <span className={isActive ? 'font-semibold' : 'font-medium'}>
                {tab.label}
              </span>
              {tab.count !== undefined && tab.count > 0 && (
                <motion.span
                  className={`
                    inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 
                    rounded-md text-[11px] font-semibold
                    ${isActive 
                      ? 'bg-primary-foreground text-primary' 
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {tab.count}
                </motion.span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
