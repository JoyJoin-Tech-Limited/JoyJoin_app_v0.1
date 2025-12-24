import JoyJoinLogo from '../JoyJoinLogo';

export default function JoyJoinLogoExample() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <JoyJoinLogo size="sm" />
      <JoyJoinLogo size="md" />
      <JoyJoinLogo size="lg" />
      <JoyJoinLogo size="md" showEnglish={false} />
    </div>
  );
}
