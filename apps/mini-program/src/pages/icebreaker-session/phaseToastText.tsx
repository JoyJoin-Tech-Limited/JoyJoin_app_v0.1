import type { ReactNode } from 'react'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'

export function getPhaseToastText(phase: string): ReactNode {
  const texts: Record<string, ReactNode> = {
    lie_detective: <>真相只有一个！<JoyJoinIcon emoji='🕵️' tier='phase' size={24} /></>,
    auction: <>竞拍开始，准备好你的虚拟币！<JoyJoinIcon emoji='💰' size={24} /></>,
    personality_dice: <>人格骰子，看看今天的运势！<JoyJoinIcon emoji='🎲' tier='phase' size={24} /></>,
    quip_battle: <>接梗大战，接得住吗？<JoyJoinIcon emoji='😏' size={24} /></>,
    undercover_word: <>谁是卧底？小心别暴露！<JoyJoinIcon emoji='🕵️' tier='phase' size={24} /></>,
    speed_friending: <>快速交友，认识新伙伴！<JoyJoinIcon emoji='🤝' size={24} /></>,
    group_mirror: <>团队镜像，看看大家的默契！<JoyJoinIcon emoji='🪞' size={24} /></>,
    recap: <>精彩回顾，今天真开心！<JoyJoinIcon emoji='🎉' tier='reaction' size={24} /></>,
  }
  return texts[phase] || '新阶段开始啦！'
}
