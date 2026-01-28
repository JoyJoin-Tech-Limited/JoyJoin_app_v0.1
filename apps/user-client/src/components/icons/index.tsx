import SkillEmpathy from './SkillEmpathy';
import SkillCreativity from './SkillCreativity';
import SkillOrganization from './SkillOrganization';
import SkillLeadership from './SkillLeadership';
import SkillListening from './SkillListening';
import SkillAnalysis from './SkillAnalysis';
import SkillExecution from './SkillExecution';
import SkillStability from './SkillStability';

export interface SkillIconProps {
  className?: string;
  color?: string;
}

export type SkillIconComponent = React.ComponentType<SkillIconProps>;

export const skillIcons: Record<string, SkillIconComponent> = {
  '共情力': SkillEmpathy,
  '创新力': SkillCreativity,
  '组织力': SkillOrganization,
  '领导力': SkillLeadership,
  '倾听力': SkillListening,
  '分析力': SkillAnalysis,
  '执行力': SkillExecution,
  '稳定力': SkillStability,
};

export function getSkillIcon(skillName: string): SkillIconComponent {
  return skillIcons[skillName] || SkillCreativity; // Default to creativity icon
}

export {
  SkillEmpathy,
  SkillCreativity,
  SkillOrganization,
  SkillLeadership,
  SkillListening,
  SkillAnalysis,
  SkillExecution,
  SkillStability,
};
