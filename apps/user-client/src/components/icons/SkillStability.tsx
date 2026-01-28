interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillStability({ className = "w-6 h-6", color = "#6B7280" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="stability-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Shield representing stability and protection */}
      <path d="M12 3L5 6V11C5 15.5 8 19.5 12 21C16 19.5 19 15.5 19 11V6L12 3Z" 
        fill="url(#stability-gradient)" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Inner shield detail */}
      <path d="M12 6L8 8V11C8 13.5 9.5 16 12 17.5C14.5 16 16 13.5 16 11V8L12 6Z" 
        fill="white" opacity="0.4"/>
      {/* Center emblem */}
      <circle cx="12" cy="11" r="2" fill="white" opacity="0.8"/>
    </svg>
  );
}
