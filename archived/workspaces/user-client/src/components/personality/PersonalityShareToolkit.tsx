import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, MessageSquare, Sparkles, Tags, Users } from "lucide-react";
import type { PersonalityShareVariants } from "@/lib/personalityResultShareToolkit";

interface PersonalityShareToolkitProps {
  headline: string;
  shareLine: string;
  stateLabel: string;
  expressionTags: string[];
  blendLine: string;
  whyThisFits: string;
  shareVariants: PersonalityShareVariants;
  onCopyPrimary: () => void;
  onCopyVariant: (variantKey: keyof PersonalityShareVariants, text: string) => void;
}

const variantMeta: Array<{
  key: keyof PersonalityShareVariants;
  label: string;
  hint: string;
}> = [
  { key: "selfIntro", label: "自我介绍型", hint: "适合评论区 / 聊天开场" },
  { key: "friendCallout", label: "朋友互动型", hint: "适合发给朋友 / 配朋友圈" },
  { key: "socialInvite", label: "轻邀约型", hint: "适合顺手带出下一次见面" },
];

export function PersonalityShareToolkit({
  headline,
  shareLine,
  stateLabel,
  expressionTags,
  blendLine,
  whyThisFits,
  shareVariants,
  onCopyPrimary,
  onCopyVariant,
}: PersonalityShareToolkitProps) {
  return (
    <div className="space-y-3">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <MessageSquare className="w-4 h-4" />
            一句像你的话
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold leading-snug" data-testid="text-xiaoyue-headline">
              {headline}
            </p>
            <div className="rounded-xl border bg-background/90 px-3 py-3">
              <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-xiaoyue-share-line">
                {shareLine}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {stateLabel}
            </Badge>
            <Button variant="outline" size="sm" onClick={onCopyPrimary}>
              <Copy className="w-4 h-4 mr-2" />
              复制文字版结果
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Tags className="w-4 h-4 text-primary" />
              适合小红书 / 朋友圈传播的标签
            </div>
            <div className="flex flex-wrap gap-2">
              {expressionTags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full border-primary/20 bg-background/80">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            这版更适合先发评论区或聊天框。想晒图的话，页底还有一张 Pokémon 风格海报。
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/70">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              这次推断里的边界感
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{blendLine}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="w-4 h-4 text-primary" />
              为什么会落在这个原型
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{whyThisFits}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <MessageSquare className="w-4 h-4" />
            可直接复制的三种发法
          </div>
          <div className="space-y-3">
            {variantMeta.map(({ key, label, hint }) => (
              <div key={key} className="rounded-xl border bg-background/80 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        模板
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCopyVariant(key, shareVariants[key])}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制
                  </Button>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{shareVariants[key]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PersonalityShareToolkit;
