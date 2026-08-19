import { FlashDialoguePage, type CustomLaterActAssets } from '../../alang/dialogue'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import alangSecond from '../assets/flash-alang-second-act-return-shelter-v2.jpg'
import alangThird from '../assets/flash-alang-third-act-return-cabinet-v2.jpg'
import alangCharacter from '../assets/flash-alang-character-first-act-v2.png'
import momoSecond from '../assets/flash-momo-second-act-listening-pavilion-v2.jpg'
import momoThird from '../assets/flash-momo-third-act-invitation-panels-v2.jpg'
import momoCharacter from '../assets/flash-momo-character-first-act-v2.png'
import liziSecond from '../assets/flash-lizi-second-act-color-threshold-v2.jpg'
import liziThird from '../assets/flash-lizi-third-act-outing-kiosk-v2.jpg'
import liziCharacter from '../assets/flash-lizi-character-first-act-v2.png'
import shiqiSecond from '../assets/flash-shiqi-second-act-public-record-wall-v2.jpg'
import shiqiThird from '../assets/flash-shiqi-third-act-privacy-return-v2.jpg'
import shiqiCharacter from '../assets/flash-shiqi-character-first-act-v2.png'

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
  return <FlashDialoguePage customLaterActAssets={CUSTOM_LATER_ACT_ASSETS} canonicalPath={MINI_PROGRAM_ROUTES.alangLaterDialogue} />
}
