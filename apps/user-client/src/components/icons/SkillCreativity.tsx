interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillCreativity({ className = "w-6 h-6", color = "#FFD93D" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="creativity-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Star burst representing creativity */}
      <path d="M12 2L14 8L20 8L15 12L17 18L12 14L7 18L9 12L4 8L10 8L12 2Z" fill="url(#creativity-gradient)" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Inner sparkle */}
      <circle cx="12" cy="10" r="2.5" fill="white" opacity="0.9"/>
    </svg>
  );
}
