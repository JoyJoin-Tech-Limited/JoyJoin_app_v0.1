import Taro from '@tarojs/taro'

export async function leaveFlashStory(url: string): Promise<void> {
  try {
    await Taro.redirectTo({ url })
  } catch (error) {
    console.error('[Flash] redirectTo failed while leaving settled story; falling back to reLaunch', error)
    await Taro.reLaunch({ url })
  }
}
