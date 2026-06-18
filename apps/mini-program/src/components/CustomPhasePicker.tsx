import { View, Text, Button } from '@tarojs/components';
import type { SocialIcebreakerPhase, SelectablePhaseInfo } from '@shared/socialIcebreaker';

interface CustomPhasePickerProps {
  phases?: SelectablePhaseInfo[];
  onSelect?: (phase: SocialIcebreakerPhase) => void;
  onEnd?: () => void;
  disabled?: boolean;
}

export function CustomPhasePicker({ phases = [], onSelect, onEnd, disabled }: CustomPhasePickerProps) {
  return (
    <View className='custom-phase-picker'>
      <Text className='custom-phase-picker__title'>选择下一个环节</Text>
      {phases.map((phase) => (
        <Button
          key={phase.phase}
          disabled={disabled || phase.disabled}
          onClick={() => onSelect?.(phase.phase)}
        >
          {phase.emoji} {phase.name}
        </Button>
      ))}
      <Button disabled={disabled} onClick={onEnd}>
        结束派对
      </Button>
    </View>
  );
}

export default CustomPhasePicker;
