import type { LaterActStoryConfig } from './LaterActStoryExperience'

export type AlangLaterActUnitId = 's1-p2-alang' | 's1-p3-alang'
export type LiziLaterActUnitId = 's1-p2-lizi' | 's1-p3-lizi'
export type MomoLaterActUnitId = 's1-p2-momo' | 's1-p3-momo'
export type ShiqiLaterActUnitId = 's1-p2-shiqi' | 's1-p3-shiqi'
export type CustomLaterActUnitId = AlangLaterActUnitId | LiziLaterActUnitId | MomoLaterActUnitId | ShiqiLaterActUnitId
export type FlatLaterActUnitId = LiziLaterActUnitId | MomoLaterActUnitId | 's1-p2-shiqi'

export const ALANG_LATER_ACT_UNIT_IDS = new Set<string>(['s1-p2-alang', 's1-p3-alang'])
export const LIZI_LATER_ACT_UNIT_IDS = new Set<string>(['s1-p2-lizi', 's1-p3-lizi'])
export const MOMO_LATER_ACT_UNIT_IDS = new Set<string>(['s1-p2-momo', 's1-p3-momo'])

export function isAlangLaterActUnitId(value: string): value is AlangLaterActUnitId {
  return ALANG_LATER_ACT_UNIT_IDS.has(value)
}

export function isMomoLaterActUnitId(value: string): value is MomoLaterActUnitId {
  return MOMO_LATER_ACT_UNIT_IDS.has(value)
}

export function isLiziLaterActUnitId(value: string): value is LiziLaterActUnitId {
  return LIZI_LATER_ACT_UNIT_IDS.has(value)
}

export function isFlatLaterActUnitId(value: string): value is FlatLaterActUnitId {
  return isLiziLaterActUnitId(value) || isMomoLaterActUnitId(value) || value === 's1-p2-shiqi'
}

const ALANG_SECOND_ACT: LaterActStoryConfig = {
  unitId: 's1-p2-alang',
  npcName: '阿浪',
  rootClassName: 'alang-later-act alang-later-act--second',
  chapter: '第二幕 · 断在半程的路线',
  title: '雨后的路线没有画到终点',
  opening: '我把走过的那一半留着了。不是等谁替我补完，只是还没决定要走到哪里。',
  approaches: [
    { id: 'read-traces-first', label: '先看本子被雨打湿的地方', hint: '从已经发生的路线开始', response: '湿掉的是已经走过的那段。没画下去的地方，不该凭想象补上。' },
    { id: 'ask-why-stopped', label: '先问他为什么停在半程', hint: '把决定还给正在走的人', response: '因为走到这里时，我第一次发现：继续和停下，都得由我自己说。' },
  ],
  highlights: [
    { id: 'wet-notebook', label: '被雨压皱的路线本', clue: '水痕只盖住前半段，后半页一直是干净的。阿浪没有画错终点——他根本没替未来写终点。', placementClassName: 'alang-p2__hotspot--notebook' },
    { id: 'old-ticket', label: '夹在页边的旧票根', clue: '票根日期和最后一段路线重合。它证明阿浪真的走到过这里，不是一张想象出来的地图。', placementClassName: 'alang-p2__hotspot--ticket' },
    { id: 'return-footprints', label: '折回亭里的湿脚印', clue: '脚印从河边折回遮雨亭。停下来不是失败，而是阿浪为自己保留的一次重新判断。', placementClassName: 'alang-p2__hotspot--footprints' },
  ],
  objectTarget: { label: '湿路线本', placementClassName: 'alang-p2__hotspot--route-book' },
  objectExploration: {
    title: '翻开湿路线本',
    shortLabel: '路线本',
    intro: '纸页内部把“走过”与“还没决定”分得很清楚。先把三处真实痕迹看完。',
    details: [
      { id: 'waterline', label: '停在中段的水线', clue: '水线和雨天的步行距离完全一致，说明这部分已经发生。' },
      { id: 'pencil-pressure', label: '越来越轻的铅笔痕', clue: '靠近末端时笔迹变轻。阿浪犹豫过，但没有把犹豫伪装成答案。' },
      { id: 'blank-fold', label: '向内折好的空白页', clue: '空白页被仔细保护着。它不是漏写，而是被留下来的选择。' },
    ],
  },
  followUpPrompt: '这张图断在这里，你想把哪一件事问清楚？',
  followUps: [
    { id: 'note-empty', label: '空白页是留给下一次出发的吗？', response: '是留给下一次决定。可能继续，也可能换路，但不会让别人替我画。' },
    { id: 'ask-tear', label: '你为什么没有把没走完的页撕掉？', response: '因为停下也属于这条路。承认没走完，比画一个假的终点更完整。' },
  ],
  game: {
    eyebrow: '阿浪的半程路线',
    title: '只接回已经留下的路线',
    intro: '按真实痕迹复原三步。没有发生的终点继续留白，选错不会推进。',
    startLabel: '开始接回路线',
    steps: [
      { id: 'place-start', prompt: '先放下哪一段？', choices: [
        { id: 'place-ticket-start', label: '把票根日期放在起点', correct: true, feedback: '日期先确定了这次出发真实发生过。' },
        { id: 'invent-destination', label: '先替阿浪写下终点', correct: false, feedback: '终点还没有发生。先从能被证实的起点开始。' },
      ] },
      { id: 'follow-waterline', prompt: '中段路线按什么接？', choices: [
        { id: 'follow-wet-line', label: '沿水线接到遮雨亭', correct: true, feedback: '水线和脚印把路线稳稳接回了亭里。' },
        { id: 'draw-straight-through', label: '画一条直线穿过空白页', correct: false, feedback: '直线会把阿浪没做过的决定也写进去。跟着现有痕迹走。' },
      ] },
      { id: 'leave-future', prompt: '最后一页怎么放？', choices: [
        { id: 'leave-page-blank', label: '保留空白，等阿浪下次决定', correct: true, feedback: '路线停在真实发生的地方，未来仍归阿浪。' },
        { id: 'complete-for-him', label: '替他补成一条完整环线', correct: false, feedback: '看起来完整，不等于真的完整。不要替正在走的人决定未来。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '路线停在真实发生的地方',
    speech: '原来没画完，也可以是一张诚实的地图。下次从哪里出发，我会自己落笔。',
    narration: '阿浪把空白页重新折回本子。路可以接回去，但不能替人决定终点。',
    completionLabel: '收好阿浪的半程路线',
  },
  result: {
    title: '断在半程的路线',
    closing: '停下不是把路走坏；把未决定的未来留白，也是一种完整。',
    fragment: { category: 'past', title: '没有伪造终点的路线', fact: '阿浪只保留真实走过的半程，并把下一次落笔的权利留给自己。' },
  },
}

const ALANG_THIRD_ACT: LaterActStoryConfig = {
  unitId: 's1-p3-alang',
  npcName: '阿浪',
  rootClassName: 'alang-later-act alang-later-act--third',
  chapter: '第三幕 · 还回去的空白页',
  title: '有人把空白当成了一份托付',
  opening: '我曾经把空白页留给另一个人，以为那叫一起走。后来才明白，邀请不该变成替对方保管未来。',
  approaches: [
    { id: 'inspect-binding', label: '先看被拆过的装订环', hint: '找出哪些页曾被留下', response: '我把写过的和没写的分开了。不是割断关系，是把选择还回去。' },
    { id: 'inspect-return-envelope', label: '先看桌边的归还袋', hint: '确认这次要还回什么', response: '袋里没有拒绝，也没有答案。只有不该由我继续收着的空白。' },
  ],
  highlights: [
    { id: 'opened-rings', label: '被打开过的装订环', clue: '装订环只拆下后半册。阿浪保留自己走过的页，把还没发生的部分单独取出。', placementClassName: 'alang-p3__hotspot--rings' },
    { id: 'written-route', label: '写满脚注的旧路线', clue: '写过的页留下日期、天气和折返点。共同经历没有被抹掉，只是不再占用未来。', placementClassName: 'alang-p3__hotspot--written' },
    { id: 'return-envelope', label: '没有署名的归还袋', clue: '袋口没有收件人的名字。它可以被交还，却不替任何人宣告关系或回答。', placementClassName: 'alang-p3__hotspot--envelope' },
  ],
  objectTarget: { label: '空白页册', placementClassName: 'alang-p3__hotspot--blank-pages' },
  objectExploration: {
    title: '展开被取下的空白页',
    shortLabel: '空白页册',
    intro: '三种痕迹说明：这些页被认真保存过，却从来不属于某个预设的结局。',
    details: [
      { id: 'clean-edges', label: '没有书写压痕的页边', clue: '页面从未写过名字，也没有被偷偷安排过路线。' },
      { id: 'removable-thread', label: '可以解开的装订线', clue: '装订线本来就允许拆分。一起出发，不代表未来必须永远绑在一本册子里。' },
      { id: 'outside-invite', label: '夹在封套外的邀请条', clue: '邀请被放在空白页外面：它可以被看见，但不会占据回答的位置。' },
    ],
  },
  followUpPrompt: '把空白页还回去之前，你想确认什么？',
  followUps: [
    { id: 'ask-owner', label: '这些空白页原本属于谁？', response: '属于还没做决定的人。它们不该因为被我保存，就变成我的安排。' },
    { id: 'write-date', label: '要不要在页角写下今天的归还日期？', response: '写吧。这个日期只记下空白被归还的今天，不替任何人写下终点。' },
  ],
  game: {
    eyebrow: '阿浪的归还页册',
    title: '把经历、未来和邀请分开',
    intro: '先留下真实走过的页，再归还空白，最后把邀请放在外面。',
    startLabel: '开始整理页册',
    steps: [
      { id: 'keep-lived-pages', prompt: '写过日期和折返点的页放在哪里？', choices: [
        { id: 'keep-in-alang-book', label: '留在阿浪自己的路线本里', correct: true, feedback: '共同经历被诚实保留，但不会继续占用未来。' },
        { id: 'discard-all-history', label: '把所有写过的页一起丢掉', correct: false, feedback: '把选择还回去，不需要否定已经真实发生的经历。' },
      ] },
      { id: 'return-blanks', prompt: '没有写过的空白页怎么处理？', choices: [
        { id: 'place-in-return-envelope', label: '装进归还袋，不写对方名字', correct: true, feedback: '空白被完整归还，也没有替任何人宣布答案。' },
        { id: 'write-shared-ending', label: '先写好两个人的共同终点', correct: false, feedback: '那会把阿浪的愿望写成两个人的决定。空白必须保持空白。' },
      ] },
      { id: 'place-invite-outside', prompt: '最后，邀请条放在哪里？', choices: [
        { id: 'leave-invite-outside', label: '夹在封套外，只留下时间', correct: true, feedback: '邀请被说清楚，回答的位置仍然空着。' },
        { id: 'seal-invite-inside', label: '封进空白页，等同默认答应', correct: false, feedback: '邀请不能藏进对方的未来里。让它待在外面，被自由地看见。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '未来被完整归还',
    speech: '我会把邀请说清楚，也会把没决定的方向还给它的主人。有人同行很好，一个人改路也没关系。',
    narration: '阿浪在页角留下归还日期，把其余空白放进晨光里的归还袋。写过的没有被抹去，未来也不再被占着。',
    completionLabel: '收好阿浪归还的空白页',
  },
  result: {
    title: '还回去的空白页',
    closing: '日期只记录归还发生过，没决定的方向仍回到能亲自作答的人手里。',
    fragment: { category: 'relationship', title: '被归还的未来', fact: '阿浪留下共同经历与归还日期，却把未决定的方向和回答权完整归还。' },
  },
}

const MOMO_SECOND_ACT: LaterActStoryConfig = {
  unitId: 's1-p2-momo',
  npcName: '默默',
  rootClassName: 'momo-later-act momo-later-act--second',
  chapter: '第二幕 · 没有发出的颜色选择',
  title: '路线册里藏着一句没说出口的邀请',
  opening: '我把两条路画成不同颜色，却把最重要的那句话留在空白页上。颜色替我开了口，但它说得不够完整。',
  approaches: [
    { id: 'inspect-colors', label: '先核对路线真正留下的颜色', hint: '别让笔帽替笔芯作证', response: '外面的颜色被我换乱了。要看纸上真正留下的那一笔。' },
    { id: 'inspect-blank-invite', label: '先看那张没有发出的方向卡', hint: '确认邀请缺了什么', response: '我画了方向，却没写时间，也没把选择交给会收到它的人。' },
  ],
  highlights: [
    { id: 'blank-page', label: '只压出轮廓的空白页', clue: '纸上有“栗”字被擦掉后的浅压痕。默默想邀请栗子，却又把名字藏了回去。', placementClassName: 'momo-p2__hotspot--blank-page' },
    { id: 'route-swatches', label: '两条真实留下的色带', clue: '暖橙指向工作室，冷蓝指向河边。颜色是方向，不是替栗子做出的选择。', placementClassName: 'momo-p2__hotspot--swatches' },
    { id: 'mismatched-caps', label: '被换乱的笔帽', clue: '笔帽颜色和纸上痕迹不一致。默默曾试图用外观掩盖自己真正画过的邀请。', placementClassName: 'momo-p2__hotspot--caps' },
  ],
  objectTarget: { label: '旧马克笔盒', placementClassName: 'momo-p2__hotspot--marker-case' },
  objectExploration: {
    title: '打开旧马克笔盒',
    shortLabel: '笔盒',
    intro: '笔盒内部藏着三件事：真实颜色、失效的笔和没能发出的那句话。',
    details: [
      { id: 'orange-tip', label: '沾着暖橙的笔尖', clue: '笔尖与工作室路线完全吻合。这是默默真正画过的第一条方向。' },
      { id: 'dry-blue', label: '几乎干掉的冷蓝笔', clue: '冷蓝仍能留下很淡的线，说明河边方向被反复犹豫过。' },
      { id: 'unsent-card', label: '折在底层的方向卡', clue: '卡片只有两个方向，没有时间和回应空位，所以始终不像一份可以回答的邀请。' },
    ],
  },
  followUpPrompt: '你想先替默默厘清哪一个问题？',
  followUps: [
    { id: 'notice-action', label: '为什么把笔帽故意换乱？', response: '我以为看不出真实颜色，就没人知道我在期待谁。可路线早就留下了答案。' },
    { id: 'notice-relationship', label: '你真正想把选择交给谁？', response: '栗子。但我只能把两条方向说清楚，不能替她选其中一条。' },
  ],
  game: {
    eyebrow: '默默的颜色校对',
    title: '让真实笔迹重新对上路线',
    intro: '别看笔帽，跟着纸上的实际色带找出两条方向和还能写字的笔。',
    startLabel: '开始校对颜色',
    steps: [
      { id: 'match-orange', prompt: '工作室方向该用哪支笔？', choices: [
        { id: 'choose-orange-tip', label: '选笔尖沾着暖橙的那支', correct: true, feedback: '真实笔迹和工作室路线对上了。' },
        { id: 'choose-orange-cap', label: '选套着橙色笔帽的那支', correct: false, feedback: '笔帽被换乱了。请看笔尖真正留下的颜色。' },
      ] },
      { id: 'match-blue', prompt: '河边方向该怎么确认？', choices: [
        { id: 'test-blue-on-scrap', label: '在废纸上试出那条淡冷蓝', correct: true, feedback: '淡冷蓝与河边路线一致，第二条方向被找回。' },
        { id: 'guess-by-case-order', label: '按笔盒原来的顺序猜一支', correct: false, feedback: '顺序也被打乱过。让实际留下的痕迹作证。' },
      ] },
      { id: 'find-writing-pen', prompt: '最后用哪支笔补全邀请？', choices: [
        { id: 'use-working-neutral', label: '用还能清楚书写的中性笔', correct: true, feedback: '方向保留颜色，真正的邀请将用清楚可读的话说出来。' },
        { id: 'force-dry-marker', label: '继续用快干掉的冷蓝笔', correct: false, feedback: '褪色会让邀请再次含糊。先找到能把话说完整的笔。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '颜色不再替默默躲藏',
    speech: '我会保留两条颜色，也会亲口说明它们是什么。栗子选哪条，或者都不选，都由她。',
    narration: '默默把错位的笔帽留在盒底，只带走真实留下颜色的笔和那张待补全的方向卡。',
    completionLabel: '收好默默的颜色选择',
  },
  result: {
    title: '没有发出的颜色选择',
    closing: '颜色可以给方向，但邀请必须清楚地说给能亲自选择的人。',
    fragment: { category: 'object', title: '被换乱的笔帽', fact: '默默藏起真实颜色，却没能藏住那份想让栗子自己选路的邀请。' },
  },
}

const MOMO_THIRD_ACT: LaterActStoryConfig = {
  unitId: 's1-p3-momo',
  npcName: '默默',
  rootClassName: 'momo-later-act momo-later-act--third',
  chapter: '第三幕 · 把邀请说完整',
  title: '这一次，方向、时间和空白都在',
  opening: '我不想再让颜色替我猜。今天我要把邀请说完整，然后把最后一格留空。',
  approaches: [
    { id: 'read-invite-order', label: '先看邀请卡的阅读顺序', hint: '确认别人能否一眼看懂', response: '先是时间，再是两条方向，最后才是空白。这样它才像一道可以自由回答的问题。' },
    { id: 'check-blank-response', label: '先确认回应栏真的没有预设', hint: '不替栗子填入答案', response: '我只划了边框，没有写任何暗示。空着不是疏忽，是我这次最认真留下的部分。' },
  ],
  highlights: [
    { id: 'clear-time', label: '写清楚的出发时间', clue: '时间被放在卡片最上方。默默第一次没有让收件人从颜色里猜何时见面。', placementClassName: 'momo-p3__hotspot--time' },
    { id: 'two-routes', label: '并列而不相交的两条路线', clue: '暖橙与冷蓝拥有同样的长度和位置，没有哪条被偷偷画成“正确答案”。', placementClassName: 'momo-p3__hotspot--routes' },
    { id: 'blank-response', label: '没有任何浅痕的回应栏', clue: '回应栏干净得没有压痕。默默没有先写好栗子的名字、方向或答复。', placementClassName: 'momo-p3__hotspot--response' },
  ],
  objectTarget: { label: '完整邀请卡', placementClassName: 'momo-p3__hotspot--invitation' },
  objectExploration: {
    title: '展开完整邀请卡',
    shortLabel: '邀请卡',
    intro: '卡片内部不靠暗号：时间、方向与回应权被分成三格。',
    details: [
      { id: 'time-window', label: '可以调整的时间窗', clue: '默默写的是一段可商量的时间，而不是必须准时出现的命令。' },
      { id: 'equal-route-icons', label: '等大的两枚方向图标', clue: '两个方向没有主次；栗子可以选工作室、河边，也可以提出第三个地方。' },
      { id: 'reply-flap', label: '可以单独折回的回应页', clue: '回应页能被带走、稍后再填。默默不再要求当场得到答案。' },
    ],
  },
  followUpPrompt: '邀请已经能被看懂，你还想替收件人确认什么？',
  followUps: [
    { id: 'notice-object', label: '如果栗子想选第三条路呢？', response: '那就把第三条路画上去。我的两种颜色是提议，不是边界。' },
    { id: 'notice-relationship', label: '如果她暂时不回答呢？', response: '回应页可以带走。我负责把邀请说清楚，不负责规定她什么时候回答。' },
  ],
  game: {
    eyebrow: '默默的完整邀请',
    title: '按能自由回答的顺序摆好三格',
    intro: '先让对方知道何时，再看到同等的方向，最后留下真正空白的回应。',
    startLabel: '开始摆好邀请',
    steps: [
      { id: 'place-time', prompt: '第一格先放什么？', choices: [
        { id: 'place-adjustable-time', label: '放一段可以商量的出发时间', correct: true, feedback: '邀请先变得具体，也保留调整空间。' },
        { id: 'place-hidden-color-code', label: '放只有默默懂的颜色暗号', correct: false, feedback: '暗号会让对方重新猜测。第一格先把时间说清楚。' },
      ] },
      { id: 'place-directions', prompt: '第二格如何放两条方向？', choices: [
        { id: 'place-equal-routes', label: '把暖橙和冷蓝并列放好', correct: true, feedback: '两个方向同样清楚，没有默认答案。' },
        { id: 'highlight-preferred-route', label: '把默默偏爱的路线画得更大', correct: false, feedback: '那会把偏好伪装成选择。让两条方向保持同等。' },
      ] },
      { id: 'leave-response', prompt: '最后一格怎么完成？', choices: [
        { id: 'leave-reply-blank', label: '保持空白，并允许稍后带回', correct: true, feedback: '默默完成了自己的邀请，栗子的回应仍完全属于栗子。' },
        { id: 'prefill-yes', label: '先替栗子勾上“会来”', correct: false, feedback: '完整邀请不等于完整答案。最后一格必须由收到它的人亲自填写。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '邀请终于成为一句完整的话',
    speech: '时间和方向我都写清楚了。最后这一格，我不会再碰。等栗子想回答时，她会自己写。',
    narration: '默默把邀请卡放进透明封套。两条颜色都看得见，空白回应栏也同样醒目。',
    completionLabel: '收好默默完整的邀请',
  },
  result: {
    title: '把邀请说完整',
    closing: '默默完成了表达，却没有完成别人的答案。',
    fragment: { category: 'relationship', title: '可以稍后回答的邀请', fact: '默默写清时间与两个方向，并把无期限的回应权完整留给栗子。' },
  },
}

const SHIQI_SECOND_ACT: LaterActStoryConfig = {
  unitId: 's1-p2-shiqi',
  npcName: '拾柒',
  rootClassName: 'shiqi-later-act shiqi-later-act--second',
  chapter: '第二幕 · 准确记录的边界',
  title: '准确写下，不等于有权留下',
  opening: '我先检查五张卡有没有被翻过。按原顺序码好以后，我确认没有人动过。真正让我停下的，是自己为什么会把一个人的固定时间写进去。',
  approaches: [
    { id: 'check-card-order', label: '先核对五张卡原本的顺序', hint: '先确认卡片是否真的被动过', response: '顺序和边角痕迹都对得上。这次没有人碰过它们，越界的内容从一开始就是我写下的。' },
    { id: 'separate-private-card', label: '先把写着个人规律的卡单独取出', hint: '准确与可保存不是同一件事', response: '这张写得最准确，也最不应该继续和城市观察放在一起。' },
  ],
  highlights: [
    { id: 'five-card-order', label: '保持原顺序的五张观察卡', clue: '卡片边角与编号一一对应，没有新翻动的痕迹。问题不在别人碰过记录，而在其中一张从一开始就写进了不该长期保存的个人规律。', placementClassName: 'shiqi-p2__hotspot--cards' },
    { id: 'schedule-grid', label: '过分精确的时间方格', clue: '同一个时间段被连续标了多次，已经足以推断个人习惯。记录很准确，却超过了理解城市所需要的范围。', placementClassName: 'shiqi-p2__hotspot--schedule' },
    { id: 'older-key-card', label: '压在最底下的旧钥匙卡', clue: '钥匙轮廓旁有三道短线，纸张比这批观察卡更旧。它不属于本次交换，也不该被混进当前记录。', placementClassName: 'shiqi-p2__hotspot--key-card' },
  ],
  objectTarget: { label: '被单独留下的观察卡', placementClassName: 'shiqi-p2__hotspot--private-card' },
  objectExploration: {
    title: '拆开观察卡的三层信息',
    shortLabel: '观察卡',
    intro: '同一张卡上混着城市、时间和个人路线。先分清哪些帮助理解环境，哪些已经能追踪一个人。',
    details: [
      { id: 'city-front', label: '正面的城市转角', clue: '路口、树影和坡度属于任何经过这里的人，可以被保留为公共观察。' },
      { id: 'fixed-time-grid', label: '背面的固定时间格', clue: '连续出现的准确时间不再是城市细节，而是在描出一个人的生活规律。' },
      { id: 'unlisted-detour', label: '没有画进册子的绕行线', clue: '一条反复出现的绕路轨迹与固定时间叠加后，已经足以追踪个人行动。' },
    ],
  },
  followUpPrompt: '分清三层信息以后，你想先问拾柒哪一句？',
  followUps: [
    { id: 'ask-privacy', label: '记录被翻过，你很在意吗？', response: '会在意。但这次我确认没有人动过。卡里越界的内容不是别人造成的，仍然是我的责任。' },
    { id: 'ask-delete', label: '那条写得很准确的记录，会删掉吗？', response: '会。准确只能说明观察发生过，不能替我获得长期保存它的权利。' },
  ],
  game: {
    eyebrow: '拾柒的信息分层',
    title: '留下城市，把个人规律完整遮住',
    intro: '依次判断环境、时间和绕行线。错误选择不会推进，遮住也不是把事实伪装成没有发生。',
    startLabel: '开始拆分观察卡',
    steps: [
      { id: 'keep-city-detail', prompt: '第一层城市转角应该怎样处理？', choices: [
        { id: 'keep-public-corner', label: '保留任何人都能看见的路口与树影', correct: true, feedback: '公共环境留下了，不需要借助任何人的活动规律来成立。' },
        { id: 'discard-whole-city', label: '把整张城市观察一起销毁', correct: false, feedback: '边界不等于抹掉城市。先留下不指向具体个人的部分。' },
      ] },
      { id: 'cover-fixed-time', prompt: '连续出现的固定时间格怎么办？', choices: [
        { id: 'seal-time-grid', label: '用不透光的封条完整盖住', correct: true, feedback: '准确时间被隔离，卡片不再暴露个人规律。' },
        { id: 'keep-for-accuracy', label: '因为写得准确，所以继续保留', correct: false, feedback: '准确不是保留许可。先问它是否已经能追踪一个人。' },
      ] },
      { id: 'remove-detour', prompt: '最后怎样处理反复出现的绕行线？', choices: [
        { id: 'separate-detour-card', label: '从公共卡中取出，交回当事人处理', correct: true, feedback: '城市细节与个人路线被分开，决定权回到被记录的人手里。' },
        { id: 'publish-detour-pattern', label: '把绕行规律补进公共路线图', correct: false, feedback: '这会把个人习惯扩大成所有人都能读取的线索。不要继续传播。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '准确记录被重新划定边界',
    speech: '我会保留城市的样子，删掉能追踪一个人的部分。写得准确，不代表我可以一直拥有。',
    narration: '拾柒把那张卡放进不透光封套，另外四张重新按原顺序码好。最底下的旧钥匙卡被单独夹起，没有并入这次记录。',
    completionLabel: '收好拾柒重新分层的观察卡',
  },
  result: {
    title: '准确记录的边界',
    closing: '拾柒没有否认自己看见过什么，却停止让准确成为长期保存个人规律的理由。',
    fragment: { category: 'key', title: '早于交换箱的钥匙轮廓', fact: '最旧的卡片画着一把钥匙和三道短线，日期早于这批观察卡，也不属于本次交换。' },
  },
}

const SHIQI_THIRD_ACT: LaterActStoryConfig = {
  unitId: 's1-p3-shiqi',
  npcName: '拾柒',
  rootClassName: 'shiqi-later-act shiqi-later-act--third',
  chapter: '第三幕 · 删除并不是抹掉城市',
  title: '删除的不是城市，是不该保留的规律',
  opening: '我把五张卡背面的名字朝下。城市细节可以留下，那张写着固定活动时间的卡必须单独处理。',
  approaches: [
    { id: 'inspect-four-city-cards', label: '先确认其余四张卡还能留下什么', hint: '删除应当精确，不扩大损失', response: '四张卡只描述光线、坡度、树和路口。它们不需要依附任何人的行程。' },
    { id: 'inspect-folded-private-card', label: '先看被折起的那张私人记录', hint: '确认哪些内容必须永久移除', response: '折痕把时间行与城市细节分开了。我没有撕掉整张卡，因为错的是保留范围，不是城市本身。' },
  ],
  highlights: [
    { id: 'four-card-envelope', label: '装着四张城市卡的信封', clue: '四张卡只有抽象地点与环境变化，不含姓名、固定时间或个人路线。它们仍能帮助理解城市。', placementClassName: 'shiqi-p3__hotspot--envelope' },
    { id: 'folded-private-card', label: '被单独折起的第五张卡', clue: '卡片被沿信息层折开，正面城市观察仍清楚，背面的个人时间已经与其分离。', placementClassName: 'shiqi-p3__hotspot--folded-card' },
    { id: 'dark-cover-strip', label: '没有透光缝隙的遮盖条', clue: '遮盖条宽过整行时间记录，不留能够重新拼回规律的残片。删除不是只让它暂时看不见。', placementClassName: 'shiqi-p3__hotspot--cover' },
  ],
  objectTarget: { label: '待归还的第五张卡', placementClassName: 'shiqi-p3__hotspot--private-card' },
  objectExploration: {
    title: '确认第五张卡该留下与该删除的部分',
    shortLabel: '第五张卡',
    intro: '卡上有三层内容。只有逐层处理，才能避免“全部保留”和“全部抹掉”这两种同样粗糙的答案。',
    details: [
      { id: 'shareable-city-layer', label: '可分享的城市正面', clue: '树影、坡道和路口不指向某个人，可以继续作为城市观察存在。' },
      { id: 'private-time-strip', label: '固定活动时间条', clue: '多次出现的时间已经构成可预测规律，必须永久从共享记录中移除。' },
      { id: 'last-route-note', label: '压在下面的末班路线', clue: '路线与时间组合后进一步缩小了个人去向范围，不能作为“补充细节”继续留下。' },
    ],
  },
  followUpPrompt: '真正删除以前，你想把哪一件事说清楚？',
  followUps: [
    { id: 'note-boundary', label: '这张卡本来就不该留在共享箱里。', response: '是整理失误。但把规律记录下来，是更早的判断失误。两件事都要承认。' },
    { id: 'hand-back', label: '把这张卡当面递回去，让当事人决定。', response: '可以。城市部分继续留下，私人部分由被记录的人确认已经无法被复原。' },
  ],
  game: {
    eyebrow: '拾柒的删除校验',
    title: '精确删除越界记录，再归还决定权',
    intro: '先保留公共观察，再移除时间与路线，最后把处理后的卡从共享箱中交还。',
    startLabel: '开始处理第五张卡',
    steps: [
      { id: 'retain-city-face', prompt: '卡片正面的城市观察怎么处理？', choices: [
        { id: 'retain-shareable-face', label: '保留不指向个人的树影、坡道和路口', correct: true, feedback: '城市仍被看见，删除没有扩大到与边界无关的部分。' },
        { id: 'tear-entire-card', label: '把整张卡撕碎，连城市也一起抹掉', correct: false, feedback: '越界的是个人规律，不是所有观察。先把两层准确分开。' },
      ] },
      { id: 'remove-private-lines', prompt: '时间行和末班路线应该怎样删除？', choices: [
        { id: 'remove-both-private-lines', label: '整段取出并封存销毁，不留可拼回的残片', correct: true, feedback: '时间与路线一起消失，个人规律无法从共享记录复原。' },
        { id: 'blur-one-digit', label: '只遮住一小格，其他规律继续保留', correct: false, feedback: '局部遮盖仍能推断规律。删除必须覆盖整段可识别信息。' },
      ] },
      { id: 'return-card', prompt: '处理后的第五张卡最后放在哪里？', choices: [
        { id: 'return-outside-envelope', label: '折起后单独交还，不再装回共享信封', correct: true, feedback: '四张城市卡回到信封，第五张的决定权回到当事人手里。' },
        { id: 'hide-among-four', label: '藏回四张卡中，假装没有发生', correct: false, feedback: '藏起来不是处理。越界记录必须退出共享系统，也必须让归还动作可确认。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '越界记录已经无法被复原',
    speech: '我保留了城市，删除了规律，也不会把第五张卡重新放回共享箱。记录发生过，边界也必须真的恢复。',
    narration: '四张城市卡被装回信封。第五张折起后单独留下，时间条与末班路线已经取出。纸背那把更早的钥匙轮廓没有被解释，只被诚实地保留为另一条线索。',
    completionLabel: '收好拾柒删除并归还的记录',
  },
  result: {
    title: '删除那条不该保留的记录',
    closing: '拾柒删掉了能够追踪个人的时间与路线，却让城市观察和归还动作都留下了清楚证据。',
    fragment: { category: 'relationship', title: '退出共享箱的第五张卡', fact: '个人规律被永久移除，第五张卡不再回到共享信封；城市仍被记录，决定权已经归还。' },
  },
}

const LIZI_SECOND_ACT: LaterActStoryConfig = {
  unitId: 's1-p2-lizi',
  npcName: '栗子',
  rootClassName: 'lizi-later-act lizi-later-act--second',
  chapter: '第二幕 · 反复圈住的普通一天',
  title: '圈了很多次，却一次也没有出发',
  opening: '我把三个地方一遍遍圈重，好像只要再比较一次，就能选出绝对不会后悔的那个。结果册子越来越满，我还是坐在原地。',
  approaches: [
    { id: 'compare-circle-layers', label: '先把三层圈痕叠在一起看', hint: '确认栗子真正反复保留的项目', response: '别先找最好看的那一项。三层纸上都没有被擦掉的，才是我一直舍不得放下的。' },
    { id: 'inspect-faded-lanyard', label: '先看册脊上褪色的挂绳', hint: '一件旧物可能比清单更早', response: '这截绳子不是册子原配的。我只是一直没想起来，它最早系住过什么。' },
  ],
  highlights: [
    { id: 'circle-overlays', label: '叠在一起的三层圈痕', clue: '三张透明页的圈法不同，却都经过同一个小格。栗子不是没有偏好，而是一直不敢相信最普通的偏好也算数。', placementClassName: 'lizi-p2__hotspot--overlays' },
    { id: 'faded-lanyard', label: '褪成青灰色的挂绳', clue: '挂绳靠近扣环的位置磨出三道短痕，比册子的装订孔旧得多。它曾经系着另一件经常被拿起的东西。', placementClassName: 'lizi-p2__hotspot--lanyard' },
    { id: 'unused-stool', label: '一直没有挪动的木凳', clue: '凳脚周围没有新的划痕。栗子做了很多计划，却没有真正从这里起身。', placementClassName: 'lizi-p2__hotspot--stool' },
  ],
  objectTarget: { label: '出门册', placementClassName: 'lizi-p2__hotspot--outing-book' },
  objectExploration: {
    title: '翻开圈选最密的出门册',
    shortLabel: '出门册',
    intro: '册子没有替栗子选出“最好”的地方，却留下三种比排名更诚实的痕迹。',
    details: [
      { id: 'same-small-grid', label: '三次都保留的小格', clue: '它没有最醒目的装饰，也不是最远的路线，只是每次删减后都还留在纸上。' },
      { id: 'lighter-alternatives', label: '越来越轻的其他圈线', clue: '另外两项的笔迹一次比一次浅。栗子其实已经在放下，只是没有承认。' },
      { id: 'pressed-page-corner', label: '反复被按住的页角', clue: '页角的磨损正对着那个小格。犹豫时，栗子的手总会停回同一个位置。' },
    ],
  },
  followUpPrompt: '看完这些反复留下的痕迹，你想先问栗子哪一句？',
  followUps: [
    { id: 'ask-why', label: '为什么同一个地方要圈这么多遍？', response: '我总觉得，再比一次就能证明它值得。其实我怕的不是选错，是去了以后发现它普通得很。' },
    { id: 'suggest-delete', label: '如果删到只剩这一项，会不会更容易出发？', response: '可能会。但不是因为它赢了，而是因为我终于不用让每次出门都通过一场评审。' },
  ],
  game: {
    eyebrow: '栗子的圈痕复原',
    title: '把三次犹豫叠回同一个小格',
    intro: '按纸页真正留下的磨损复原三层圈选。选错不会推进，也不用替栗子评价哪里最值得。',
    startLabel: '开始叠回圈痕',
    steps: [
      { id: 'anchor-first-sheet', prompt: '第一层纸先按什么位置放稳？', choices: [
        { id: 'align-binding-holes', label: '让装订孔和册脊对齐', correct: true, feedback: '装订孔确定了纸页真正的方向，第一层不再漂移。' },
        { id: 'center-prettiest-circle', label: '把最漂亮的圈放在正中', correct: false, feedback: '漂亮不是定位依据。先找不会因犹豫而改变的装订孔。' },
      ] },
      { id: 'align-second-sheet', prompt: '第二层怎样才能和第一次重合？', choices: [
        { id: 'match-worn-corner', label: '把磨旧的页角压回同一边', correct: true, feedback: '页角回到原位，两个较轻的圈也对上了。' },
        { id: 'rotate-largest-mark', label: '转到最大的圈看起来最圆', correct: false, feedback: '圈的大小会变，页角的磨损不会。跟着真实使用痕迹走。' },
      ] },
      { id: 'find-repeated-grid', prompt: '三层都放好后，最后留下哪一格？', choices: [
        { id: 'keep-shared-small-grid', label: '留下三次都经过的那个小格', correct: true, feedback: '没有评选“最好”，只是认出了栗子一次次没有删掉的选择。' },
        { id: 'keep-most-decorated-grid', label: '留下图案最多、看起来最特别的一格', correct: false, feedback: '特别不等于被反复保留。先看三层纸真正重合在哪里。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '反复保留的项目终于被看见',
    speech: '原来我不是没有想去的地方。我只是一直要求它先证明自己不会普通。',
    narration: '栗子没有删掉另外两项，只把三层纸叠好，在共同的小格旁轻轻压下一道痕。褪色挂绳从册脊滑出，扣环上的三道磨痕露了出来。',
    completionLabel: '收好栗子反复圈过的这一页',
  },
  result: {
    title: '反复圈住的普通一天',
    closing: '栗子没有选出最值得的一项，只承认了自己一直没有舍得删掉的那一项。',
    fragment: { category: 'key', title: '有三道磨痕的旧挂绳', fact: '出门册上的挂绳比册子更旧，扣环的三道短痕像是曾经系过一把钥匙。' },
  },
}

const LIZI_THIRD_ACT: LaterActStoryConfig = {
  unitId: 's1-p3-lizi',
  npcName: '栗子',
  rootClassName: 'lizi-later-act lizi-later-act--third',
  chapter: '第三幕 · 第一格真的发生了',
  title: '最小的一格，终于被标成了发生过',
  opening: '我去了最普通的那一项。没有风景奇迹，也没有突然变勇敢，只是走过去，买了一瓶水，再走回来。',
  approaches: [
    { id: 'inspect-water-trace', label: '先看桌上的水瓶和折痕', hint: '从确实发生的动作开始', response: '瓶子快空了，桌面也留下了一圈水痕。普通，但不是想象出来的。' },
    { id: 'inspect-first-mark', label: '先看册子里的第一个完成标记', hint: '只记录发生，不急着评分', response: '这个标记很小。我怕画得太重，又会把一次出门变成必须证明价值的事。' },
  ],
  highlights: [
    { id: 'water-bottle', label: '喝到只剩一点的水瓶', clue: '瓶身沾着雨后的凉气，桌面留下完整水环。它证明栗子确实到过那里，又平安回来了。', placementClassName: 'lizi-p3__hotspot--bottle' },
    { id: 'first-stamp', label: '第一格旁的浅色印记', clue: '印记没有星级，也没有评价，只表示这件小事已经发生。栗子第一次没有要求普通经历变得特别。', placementClassName: 'lizi-p3__hotspot--stamp' },
    { id: 'blank-next-page', label: '仍然空着的下一页', clue: '下一页没有被提前填满。完成第一项以后，栗子没有立刻用新的清单追赶自己。', placementClassName: 'lizi-p3__hotspot--blank' },
  ],
  objectTarget: { label: '出门册第一格', placementClassName: 'lizi-p3__hotspot--outing-book' },
  objectExploration: {
    title: '确认第一格真正留下的三处证据',
    shortLabel: '第一格',
    intro: '这次不比较地点，也不计算值不值得。只把已经发生的动作放回册子。',
    details: [
      { id: 'stamp-edge', label: '没有评级的印记边缘', clue: '印记只有轮廓，没有分数。它记录完成，却拒绝把一天压成好坏。' },
      { id: 'bottle-ring', label: '页角淡淡的水环', clue: '水环与桌上的瓶底吻合，是一次普通停留留下的具体证据。' },
      { id: 'lanyard-grooves', label: '挂绳扣环的三道短痕', clue: '栗子终于想起，这截绳子曾系在一把钥匙上。那把钥匙比出门册里的计划更早出现。' },
    ],
  },
  followUpPrompt: '第一格已经发生，你最想接着问栗子什么？',
  followUps: [
    { id: 'ask-feel', label: '完成的感觉怎么样？', response: '普通得很。就是去了，买了水，又回来。但我第一次觉得，普通也可以被认真记住。' },
    { id: 'ask-next', label: '下一项是什么？', response: '还没决定，也没想好跟谁一起去。今天先让这一格安静地待着。' },
  ],
  game: {
    eyebrow: '栗子的第一格记录',
    title: '只标记发生，不替这一天打分',
    intro: '把证据、完成标记和下一页依次放好。普通经历不需要被包装成惊喜才算完成。',
    startLabel: '开始记录第一格',
    steps: [
      { id: 'confirm-event', prompt: '先用哪一件东西确认栗子真的去过？', choices: [
        { id: 'use-bottle-ring', label: '对上水瓶底和页角的水环', correct: true, feedback: '两个水环吻合，这次出门有了不夸张的证据。' },
        { id: 'invent-photo-memory', label: '补一张并不存在的风景照片', correct: false, feedback: '不需要制造更精彩的证据。已经留下的水环就够了。' },
      ] },
      { id: 'place-completion', prompt: '完成标记应该落在哪里？', choices: [
        { id: 'mark-smallest-grid', label: '落在实际完成的最小那一格', correct: true, feedback: '这一格只被标成发生过，没有被评价够不够特别。' },
        { id: 'mark-grandest-plan', label: '落在最远、最像冒险的计划上', correct: false, feedback: '完成标记跟着事实走，不跟着计划看起来有多精彩。' },
      ] },
      { id: 'leave-next-open', prompt: '最后怎样处理下一页？', choices: [
        { id: 'leave-next-page-open', label: '保持空白，等下一次真的想出发', correct: true, feedback: '完成没有立刻变成新的催促。下一页仍属于栗子之后的决定。' },
        { id: 'fill-new-ranking', label: '马上排满新的地点和评分', correct: false, feedback: '那会让第一格再次变成考核。先让已经发生的小事完整结束。' },
      ] },
    ],
  },
  ending: {
    eyebrow: '普通的一格被认真收好',
    speech: '普通并不等于白去。我不用证明它改变了我，只要承认我真的走出去过。',
    narration: '栗子合上出门册，又把下一页轻轻留开一角。挂绳绕过指尖，三道短痕与记忆里的钥匙齿终于对上。',
    completionLabel: '收好栗子真正发生的第一格',
  },
  result: {
    title: '第一格真的发生了',
    closing: '栗子没有给这次出门评分。一次普通的往返，因为真实发生而拥有了自己的位置。',
    fragment: { category: 'past', title: '没有评分的第一格', fact: '栗子完成了最小的一项，只留下发生标记；褪色挂绳也让她想起了一把更早的钥匙。' },
  },
}

export const CUSTOM_LATER_ACT_CONFIGS: Record<CustomLaterActUnitId, LaterActStoryConfig> = {
  's1-p2-alang': ALANG_SECOND_ACT,
  's1-p3-alang': ALANG_THIRD_ACT,
  's1-p2-lizi': LIZI_SECOND_ACT,
  's1-p3-lizi': LIZI_THIRD_ACT,
  's1-p2-momo': MOMO_SECOND_ACT,
  's1-p3-momo': MOMO_THIRD_ACT,
  's1-p2-shiqi': SHIQI_SECOND_ACT,
  's1-p3-shiqi': SHIQI_THIRD_ACT,
}

export function getCustomLaterActConfig(unitId: CustomLaterActUnitId): LaterActStoryConfig {
  return CUSTOM_LATER_ACT_CONFIGS[unitId]
}
