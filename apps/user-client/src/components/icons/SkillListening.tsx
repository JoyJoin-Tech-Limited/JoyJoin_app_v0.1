interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillListening({ className = "w-6 h-6", color = "#10B981" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="listening-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Ear shape */}
      <path d="M12 4C8 4 6 7 6 10C6 13 7 16 9 18C10 19 11 20 12 20C13 19 13 18 13 17C13 15 12 14 12 12C12 10 13 9 14 9C16 9 17 10 17 12C17 15 15 18 12 20" 
        fill="url(#listening-gradient)" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Inner ear detail */}
      <path d="M12 10C11 10 10.5 10.5 10.5 11.5C10.5 12.5 11 13 12 13" fill="white" opacity="0.6"/>
    </svg>
  );
}
