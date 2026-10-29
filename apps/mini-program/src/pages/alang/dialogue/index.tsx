// Page wrapper for pages/alang/dialogue.
//
// The component itself lives in ./FlashDialoguePage so that the sibling route
// pages/alang-story/dialogue can render it WITHOUT sharing this module. Sharing
// it would make these stylesheets reachable from two page entries, and Taro
// would hoist them into the main package's root common.wxss (2 MB budget).
// See scripts/build-flash-story-styles.mjs for the full explanation.
import '../flash.scss'
import './story.scss'

export {
  FlashDialoguePage,
  type CustomLaterActAssets,
} from './FlashDialoguePage'
export { default } from './FlashDialoguePage'
