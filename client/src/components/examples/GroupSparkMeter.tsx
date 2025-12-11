import GroupSparkMeter from '../GroupSparkMeter';

export default function GroupSparkMeterExample() {
  return (
    <div className="max-w-md p-4">
      <GroupSparkMeter energizers={3} connectors={2} reflectors={3} />
    </div>
  );
}
