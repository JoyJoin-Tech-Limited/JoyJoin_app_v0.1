import { motion } from "framer-motion";
import { Sparkles, Lightbulb, HelpCircle } from "lucide-react";

interface TabNavigationProps {
  activeTab: "pool" | "flow" | "faq";
  onTabChange: (tab: "pool" | "flow" | "faq") => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: "pool" as const, label: "活动池", icon: Sparkles },
    { id: "flow" as const, label: "流程", icon: Lightbulb },
    { id: "faq" as const, label: "问答", icon: HelpCircle },
  ];

  return (
    <div className="sticky top-0 z-10 px-6 py-4 bg-background/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 p-1 rounded-full bg-gray-100 dark:bg-gray-900">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              style={{
                color: isActive 
                  ? "rgb(var(--foreground))" 
                  : "rgb(var(--muted-foreground))",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-full bg-white dark:bg-gray-800 shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                />
              )}
              
              <Icon className="h-4 w-4 relative z-10" />
              <span className="relative z-10 font-cn-display">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
