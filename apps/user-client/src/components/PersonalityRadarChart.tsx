import { getTraitScoresForArchetype } from '@/lib/archetypeTraitScores';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';

interface PersonalityRadarChartProps {
  archetype?: string;
  affinityScore?: number;
  opennessScore?: number;
  conscientiousnessScore?: number;
  emotionalStabilityScore?: number;
  extraversionScore?: number;
  positivityScore?: number;
}

// 维度含义说明
const traitDescriptions: Record<string, string> = {
  '亲和力': '与他人建立温暖联系的能力，包括友善、共情、关心他人',
  '开放性': '对新事物的好奇心和接纳度，包括创新思维、探索精神',
  '责任心': '可靠性和计划性，包括守时、言出必行、稳定可靠',
  '情绪稳定性': '面对压力时的冷静程度，包括抗压能力、情绪调节',
  '外向性': '社交能量和主动性，喜欢与人互动的程度',
  '正能量性': '乐观积极的态度，传递热情和正面能量的能力',
};

export default function PersonalityRadarChart({
  archetype,
  affinityScore,
  opennessScore,
  conscientiousnessScore,
  emotionalStabilityScore,
  extraversionScore,
  positivityScore,
}: PersonalityRadarChartProps) {
  const rawScores = archetype ? getTraitScoresForArchetype(archetype) : null;
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  
  // 分数范围：数据库存储0-100（V2测试），但原型配置是0-10
  // 如果传入分数 > 10，说明是0-100范围；否则使用原型默认分数（0-10范围）
  const normalizeScore = (score: number | undefined, fallback: number): number => {
    if (score === undefined || score === null) return fallback;
    // 已经是0-100范围的分数，直接使用
    if (score > 10) return score;
    // 0-10范围的分数，转换为0-100
    return score * 10;
  };
  
  const defaultScore = 50; // 基准分数（0-100范围）
  
  const traits = [
    { name: '亲和力', score: normalizeScore(affinityScore, rawScores ? rawScores.affinity * 10 : defaultScore), maxScore: 100 },
    { name: '开放性', score: normalizeScore(opennessScore, rawScores ? rawScores.openness * 10 : defaultScore), maxScore: 100 },
    { name: '责任心', score: normalizeScore(conscientiousnessScore, rawScores ? rawScores.conscientiousness * 10 : defaultScore), maxScore: 100 },
    { name: '情绪稳定性', score: normalizeScore(emotionalStabilityScore, rawScores ? rawScores.emotionalStability * 10 : defaultScore), maxScore: 100 },
    { name: '外向性', score: normalizeScore(extraversionScore, rawScores ? rawScores.extraversion * 10 : defaultScore), maxScore: 100 },
    { name: '正能量性', score: normalizeScore(positivityScore, rawScores ? rawScores.positivity * 10 : defaultScore), maxScore: 100 },
  ];

  const centerX = 150;
  const centerY = 150;
  const maxRadius = 100;
  
  const points = traits.map((trait, index) => {
    const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
    const ratio = trait.score / trait.maxScore;
    const x = centerX + Math.cos(angle) * maxRadius * ratio;
    const y = centerY + Math.sin(angle) * maxRadius * ratio;
    return { x, y, angle, ratio };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  const maxPolygonPoints = traits.map((_, index) => {
    const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
    const x = centerX + Math.cos(angle) * maxRadius;
    const y = centerY + Math.sin(angle) * maxRadius;
    return `${x},${y}`;
  }).join(' ');

  const labelPoints = traits.map((trait, index) => {
    const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
    const labelRadius = maxRadius + 35;
    const x = centerX + Math.cos(angle) * labelRadius;
    const y = centerY + Math.sin(angle) * labelRadius;
    return { x, y, trait, angle };
  });

  return (
    <div className="flex flex-col items-center justify-center w-full py-4">
      <svg width="100%" height="auto" viewBox="-10 -10 320 320" className="max-w-[320px]">
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
          </radialGradient>
        </defs>

        <polygon
          points={maxPolygonPoints}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.5"
        />

        {[0.25, 0.5, 0.75].map((scale) => {
          const scaledPoints = traits.map((_, index) => {
            const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
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
              strokeWidth="1"
              opacity="0.7"
            />
          );
        })}

        {traits.map((_, index) => {
          const angle = (Math.PI * 2 * index) / traits.length - Math.PI / 2;
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
              strokeWidth="1"
              opacity="0.7"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="url(#radarGradient)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />

        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="hsl(var(--primary))"
          />
        ))}

        {labelPoints.map((label, index) => {
          let textAnchor: "start" | "middle" | "end" = "middle";
          let dy = "0.35em";
          
          const angle = label.angle;
          
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

          return (
            <g key={index} className="cursor-help">
              <text
                x={label.x}
                y={label.y}
                textAnchor={textAnchor}
                dy={dy}
                className="text-[11px] font-medium fill-foreground"
                style={{ userSelect: 'none' }}
              >
                {label.trait.name}
                <title>{traitDescriptions[label.trait.name]}</title>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
