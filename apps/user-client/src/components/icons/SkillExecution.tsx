interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillExecution({ className = "w-6 h-6", color = "#F59E0B" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="execution-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Lightning bolt representing execution speed */}
      <path d="M13 2L3 14H11L10 22L20 10H12L13 2Z" fill="url(#execution-gradient)" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Highlight */}
      <path d="M11 3L9 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}
