import { useMemo, useId } from "react";

interface PersonalityRadarChartProps {
  affinityScore?: number;
  opennessScore?: number;
  conscientiousnessScore?: number;
  emotionalStabilityScore?: number;
  extraversionScore?: number;
  positivityScore?: number;
  primaryColor?: string; // Optional custom color for the radar chart
  compactMode?: boolean; // When true, renders at 140px diameter instead of 320px
  variant?: 'default' | 'compact'; // Variant mode for layout optimization
}

const traitDescriptions: Record<string, string> = {
  '亲和力': '与他人建立温暖联系的能力，包括友善、共情、关心他人',
  '开放性': '对新事物的好奇心和接纳度，包括创新思维、探索精神',
  '责任心': '可靠性和计划性，包括守时、言出必行、稳定可靠',
  '情绪稳定性': '面对压力时的冷静程度，包括抗压能力、情绪调节',
  '外向性': '社交能量和主动性，喜欢与人互动的程度',
  '正能量性': '乐观积极的态度，传递热情和正面能量的能力',
};

// Compact label mapping for share cards (short, intuitive Chinese terms)
const compactLabels: Record<string, string> = {
  'affinity': '亲和',
  'openness': '开放',
  'conscientiousness': '尽责',
  'emotionalStability': '稳定',
  'extraversion': '外向',
  'positivity': '积极',
};

export default function PersonalityRadarChart({
  affinityScore,
  opennessScore,
  conscientiousnessScore,
  emotionalStabilityScore,
  extraversionScore,
  positivityScore,
  primaryColor,
  compactMode = false,
  variant = 'default',
}: PersonalityRadarChartProps) {
  const uniqueId = useId();
  const normalizeScore = (score: number | undefined, fallback: number): number => {
    if (score === undefined || score === null) return fallback;
    if (score <= 1) return Math.round(score * 100);
    if (score <= 10) return Math.round(score * 10);
    return Math.round(score);
  };
  
  const defaultScore = 50;
  
  const userTraits = useMemo(() => [
    { name: '亲和力', key: 'affinity', score: normalizeScore(affinityScore, defaultScore), maxScore: 100 },
    { name: '开放性', key: 'openness', score: normalizeScore(opennessScore, defaultScore), maxScore: 100 },
    { name: '责任心', key: 'conscientiousness', score: normalizeScore(conscientiousnessScore, defaultScore), maxScore: 100 },
    { name: '情绪稳定性', key: 'emotionalStability', score: normalizeScore(emotionalStabilityScore, defaultScore), maxScore: 100 },
    { name: '外向性', key: 'extraversion', score: normalizeScore(extraversionScore, defaultScore), maxScore: 100 },
    { name: '正能量性', key: 'positivity', score: normalizeScore(positivityScore, defaultScore), maxScore: 100 },
  ], [affinityScore, opennessScore, conscientiousnessScore, emotionalStabilityScore, extraversionScore, positivityScore]);

  // Scale dimensions based on compact mode
  const compactScale = compactMode ? 0.4375 : 1; // 140/320 = 0.4375
  const centerX = 150 * compactScale;
  const centerY = 150 * compactScale;
  const maxRadius = 100 * compactScale;
  
  const calculatePoints = (traits: Array<{ name: string; score: number; maxScore: number }>) => {
    return traits.map((trait, index) => {
      const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
      const ratio = trait.score / trait.maxScore;
      const x = centerX + Math.cos(angle) * maxRadius * ratio;
      const y = centerY + Math.sin(angle) * maxRadius * ratio;
      return { x, y, angle, ratio };
    });
  };

  const userPoints = calculatePoints(userTraits);
  const userPolygonPoints = userPoints.map(p => `${p.x},${p.y}`).join(' ');

  const maxPolygonPoints = userTraits.map((_, index) => {
    const angle = (Math.PI * 2 * index) / userTraits.length - Math.PI / 2;
    const x = centerX + Math.cos(angle) * maxRadius;
    const y = centerY + Math.sin(angle) * maxRadius;
    return `${x},${y}`;
  }).join(' ');

  const labelPoints = userTraits.map((trait, index) => {
    const angle = (Math.PI * 2 * index) / userTraits.length - Math.PI / 2;
    // In compact variant, reduce label distance from chart and increase font size
    const labelRadius = variant === 'compact' 
      ? maxRadius + (20 * compactScale) // Closer labels in compact mode
      : maxRadius + (35 * compactScale);
    const x = centerX + Math.cos(angle) * labelRadius;
    const y = centerY + Math.sin(angle) * labelRadius;
    return { x, y, trait, angle, index };
  });

  // Use custom primary color if provided, otherwise fall back to CSS variable
  const strokeColor = primaryColor || "hsl(var(--primary))";
  const fillGradientId = primaryColor ? `customRadarGradient-${uniqueId}` : `userRadarGradient-${uniqueId}`;

  // Calculate viewBox and dimensions based on compact mode and variant
  const viewBoxSize = compactMode ? 140 : 320;
  const viewBoxPadding = compactMode ? -5 : -10;
  const maxWidth = compactMode ? 140 : 320;
  // Increase font size significantly in compact variant for better readability in share cards
  const fontSize = variant === 'compact' 
    ? (compactMode ? 10 : 13) // Larger labels for compact variant
    : (compactMode ? 6 : 11); // Original size for default variant

  return (
    <div className={`flex flex-col items-center justify-center w-full ${compactMode ? 'py-1' : 'py-4'}`}>
      <svg 
        width="100%" 
        height="auto" 
        viewBox={`${viewBoxPadding} ${viewBoxPadding} ${viewBoxSize} ${viewBoxSize}`} 
        style={{ maxWidth: `${maxWidth}px` }}
      >
        <defs>
          <radialGradient id={`userRadarGradient-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </radialGradient>
          {primaryColor && (
            <radialGradient id={`customRadarGradient-${uniqueId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.05" />
            </radialGradient>
          )}
        </defs>

        <polygon
          points={maxPolygonPoints}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1 * compactScale}
          strokeDasharray={`${4 * compactScale},${4 * compactScale}`}
          opacity="0.5"
        />

        {[0.25, 0.5, 0.75].map((scale) => {
          const scaledPoints = userTraits.map((_, index) => {
            const angle = (Math.PI * 2 * index) / userTraits.length - Math.PI / 2;
            const x = centerX + Math.cos(angle) * maxRadius * scale;
            const y = centerY + Math.sin(angle) * maxRadius * scale;
            return `${x},${y}`;
          }).join(' ');
          
          return (
            <polygon
              key={scale}
              points={scaledPoints}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={1 * compactScale}
              opacity="0.7"
            />
          );
        })}

        {userTraits.map((_, index) => {
          const angle = (Math.PI * 2 * index) / userTraits.length - Math.PI / 2;
          const x = centerX + Math.cos(angle) * maxRadius;
          const y = centerY + Math.sin(angle) * maxRadius;
          return (
            <line
              key={index}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={1 * compactScale}
              opacity="0.7"
            />
          );
        })}

        <polygon
          points={userPolygonPoints}
          fill={`url(#${fillGradientId})`}
          stroke={strokeColor}
          strokeWidth={2 * compactScale}
        />

        {userPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={5 * compactScale}
            fill={strokeColor}
          />
        ))}

        {labelPoints.map((label, index) => {
          let textAnchor: "start" | "middle" | "end" = "middle";
          let dy = "0.35em";
          
          const angle = label.angle;
          
          // Quadrant-aware alignment for compact variant to reduce overlap
          if (variant === 'compact') {
            // More precise quadrant-based alignment
            const angleDeg = (angle * 180 / Math.PI + 360) % 360;
            
            // Right side (text starts after point)
            if (angleDeg > 315 || angleDeg < 45) {
              textAnchor = "start";
              dy = "0.35em";
            }
            // Bottom right
            else if (angleDeg >= 45 && angleDeg < 90) {
              textAnchor = "start";
              dy = "-0.2em";
            }
            // Bottom
            else if (angleDeg >= 90 && angleDeg < 135) {
              textAnchor = "middle";
              dy = "-0.5em";
            }
            // Bottom left
            else if (angleDeg >= 135 && angleDeg < 180) {
              textAnchor = "end";
              dy = "-0.2em";
            }
            // Left side (text ends before point)
            else if (angleDeg >= 180 && angleDeg < 225) {
              textAnchor = "end";
              dy = "0.35em";
            }
            // Top left
            else if (angleDeg >= 225 && angleDeg < 270) {
              textAnchor = "end";
              dy = "0.8em";
            }
            // Top
            else if (angleDeg >= 270 && angleDeg < 315) {
              textAnchor = "middle";
              dy = "1em";
            }
          } else {
            // Original default alignment logic
            if (angle > -Math.PI/3 && angle < Math.PI/3) {
              textAnchor = "start";
            } else if (angle > Math.PI*2/3 || angle < -Math.PI*2/3) {
              textAnchor = "end";
            }
            
            if (angle < -Math.PI * 0.6 || angle > Math.PI * 0.6) {
              dy = "1em";
            } else if (angle > -Math.PI * 0.4 && angle < Math.PI * 0.4) {
              dy = "-0.3em";
            }
          }

          // Get label text based on variant
          const labelText = variant === 'compact' 
            ? compactLabels[label.trait.key] || label.trait.name
            : label.trait.name;

          return (
            <g key={index} className="cursor-help">
              <text
                x={label.x}
                y={label.y}
                textAnchor={textAnchor}
                dy={dy}
                fontSize={fontSize}
                className="font-medium fill-foreground"
                style={{ userSelect: 'none' }}
              >
                {labelText}
                <title>{traitDescriptions[label.trait.name]}</title>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
