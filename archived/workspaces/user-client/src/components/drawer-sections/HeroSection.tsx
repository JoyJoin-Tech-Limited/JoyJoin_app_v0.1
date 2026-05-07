import { X, MapPin, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface HeroSectionProps {
  eventType: string;
  title: string;
  date: string;
  location: string;
  groupSize: string;
  liveCount: number;
  onClose: () => void;
}

export default function HeroSection({
  eventType,
  title,
  date,
  location,
  groupSize,
  liveCount,
  onClose,
}: HeroSectionProps) {
  return (
    <div className="relative px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </Button>

      {/* Event Type Badge */}
      <Badge 
        variant="outline" 
        className="mb-3 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 border-violet-600/20"
      >
        {eventType}
      </Badge>

      {/* Title */}
      <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 mb-4 pr-8">
        {title}
      </h2>

      {/* Info Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium">
          <Calendar className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">{date}</span>
        </div>
        
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium">
          <MapPin className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">{location}</span>
        </div>
        
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium">
          <Users className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">{groupSize}</span>
        </div>
      </div>

      {/* Live Counter */}
      <motion.div 
        className="flex items-center gap-2 text-sm font-medium"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div
          className="h-2 w-2 rounded-full bg-green-500"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.7, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <span className="text-green-600 dark:text-green-400">
          {liveCount} 人已加入活动池
        </span>
      </motion.div>
    </div>
  );
}
