import { FlashDialoguePage, type CustomLaterActAssets } from '../../alang/dialogue'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import alangSecond from '../assets/flash-alang-second-act-route-pavilion-v1.jpg'
import alangThird from '../assets/flash-alang-third-act-return-pages-v1.jpg'
import alangCharacter from '../assets/flash-alang-character-official-v1.png'
import momoSecond from '../assets/flash-momo-second-act-color-route-v1.jpg'
import momoThird from '../assets/flash-momo-third-act-complete-invitation-v1.jpg'
import momoCharacter from '../assets/flash-momo-character-official-v1.png'
import liziSecond from '../assets/flash-lizi-second-act-repeated-circles-v1.jpg'
import liziThird from '../assets/flash-lizi-third-act-first-outing-v1.jpg'
import liziCharacter from '../assets/flash-lizi-character-official-v1.png'
import shiqiSecond from '../assets/flash-shiqi-second-act-private-record-v1.jpg'
import shiqiThird from '../assets/flash-shiqi-third-act-return-record-v1.jpg'
import shiqiCharacter from '../assets/flash-shiqi-character-official-v1.png'

const CUSTOM_LATER_ACT_ASSETS: CustomLaterActAssets = {
  alangSecond,
  alangThird,
  alangCharacter,
  momoSecond,
  momoThird,
  momoCharacter,
  liziSecond,
  liziThird,
  liziCharacter,
  shiqiSecond,
  shiqiThird,
  shiqiCharacter,
}

export default function FlashLaterActDialoguePage() {
  return <FlashDialoguePage customLaterActAssets={CUSTOM_LATER_ACT_ASSETS} currentPath={MINI_PROGRAM_ROUTES.alangLaterDialogue} />
}
