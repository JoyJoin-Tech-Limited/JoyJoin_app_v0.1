interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillOrganization({ className = "w-6 h-6", color = "#EF4444" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="organization-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Target circles representing organization and focus */}
      <circle cx="12" cy="12" r="9" fill="url(#organization-gradient)" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="1.5" opacity="0.7"/>
      <circle cx="12" cy="12" r="3" fill="white" opacity="0.9"/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1" fill={color}/>
    </svg>
  );
}
