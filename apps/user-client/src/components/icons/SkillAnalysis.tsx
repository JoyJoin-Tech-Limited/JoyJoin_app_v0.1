interface SkillIconProps {
  className?: string;
  color?: string;
}

export default function SkillAnalysis({ className = "w-6 h-6", color = "#8B5CF6" }: SkillIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="analysis-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Microscope/magnifying glass representing analysis */}
      <circle cx="10" cy="10" r="6" fill="none" stroke="url(#analysis-gradient)" strokeWidth="2"/>
      <circle cx="10" cy="10" r="3" fill={color} opacity="0.3"/>
      <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="url(#analysis-gradient)" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Crosshair in center */}
      <line x1="10" y1="8" x2="10" y2="12" stroke="white" strokeWidth="1" opacity="0.8"/>
      <line x1="8" y1="10" x2="12" y2="10" stroke="white" strokeWidth="1" opacity="0.8"/>
    </svg>
  );
}
