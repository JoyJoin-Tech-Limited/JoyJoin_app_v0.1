interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillLeadership({ className = "w-6 h-6", color = "#3B82F6" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leadership-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Sword representing leadership */}
      <path d="M19 3L17 5L19 7L21 5L19 3Z" fill="url(#leadership-gradient)" stroke={color} strokeWidth="1.2"/>
      <rect x="10.5" y="5" width="3" height="14" rx="0.5" fill="url(#leadership-gradient)" stroke={color} strokeWidth="1.2"/>
      <path d="M8 19L12 15L16 19L14 21L10 21L8 19Z" fill={color} stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
      {/* Shine effect */}
      <line x1="11" y1="7" x2="11" y2="16" stroke="white" strokeWidth="0.8" opacity="0.6"/>
    </svg>
  );
}
