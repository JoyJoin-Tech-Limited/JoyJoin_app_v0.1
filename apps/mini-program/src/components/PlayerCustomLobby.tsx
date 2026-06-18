import { View, Text } from '@tarojs/components';
import type { SocialSessionState } from '@shared/socialIcebreaker';

interface PlayerCustomLobbyProps {
  session?: SocialSessionState;
}

export function PlayerCustomLobby({ session }: PlayerCustomLobbyProps) {
  return (
    <View className='player-custom-lobby'>
      <Text className='player-custom-lobby__title'>等待主持人选择环节</Text>
      <Text className='player-custom-lobby__phase'>
        当前环节: {session?.currentPhase ?? 'unknown'}
      </Text>
    </View>
  );
}

export default PlayerCustomLobby;
