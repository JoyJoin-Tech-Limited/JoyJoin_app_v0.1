import JoyEventCard from '../JoyEventCard';

export default function JoyEventCardExample() {
  return (
    <div className="max-w-sm p-4">
      <JoyEventCard
        id="1"
        title="墨西哥卷挑战赛"
        time="晚上 7:30"
        area="中环"
        price="¥88"
        vibes={[
          { emoji: "⚡", label: "活力", gradient: "from-orange-400 to-red-500" },
          { emoji: "🎈", label: "玩乐", gradient: "from-pink-400 to-rose-400" },
          { emoji: "🤝", label: "社交", gradient: "from-violet-400 to-purple-400" }
        ]}
        spotsLeft={3}
        myFit={92}
        groupSpark="High"
        vibeGradient="from-orange-400 via-red-400 to-pink-500"
        iconName="pizza"
        socialProof="3位朋友的朋友已加入"
      />
    </div>
  );
}
