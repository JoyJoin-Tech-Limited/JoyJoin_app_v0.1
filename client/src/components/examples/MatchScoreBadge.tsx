import MatchScoreBadge from '../MatchScoreBadge';

export default function MatchScoreBadgeExample() {
  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-800">
      <MatchScoreBadge myFit={92} groupSpark="High" />
      <MatchScoreBadge myFit={86} groupSpark="Medium" />
      <MatchScoreBadge myFit={78} compact />
    </div>
  );
}
