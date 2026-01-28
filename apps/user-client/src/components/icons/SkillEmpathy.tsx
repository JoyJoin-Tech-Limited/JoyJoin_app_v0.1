interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillEmpathy({ className = "w-6 h-6", color = "#9B59B6" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="empathy-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Diamond shape representing empathy gem */}
      <path d="M12 2L4 8L12 22L20 8L12 2Z" fill="url(#empathy-gradient)" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Heart center */}
      <path d="M12 10C12 10 9 8 7.5 9.5C6 11 7 13 9 14.5L12 17L15 14.5C17 13 18 11 16.5 9.5C15 8 12 10 12 10Z" fill="white" opacity="0.8"/>
    </svg>
  );
}
