import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, Sparkles, Calendar, MessageCircle } from "lucide-react";

const steps = [
  {
    icon: UserCircle,
    title: "发现你的社交超能力 ✨",
    description: "3-5分钟趣味测评，生成你的专属社交人格画像，发现真实的自己~"
  },
  {
    icon: Sparkles,
    title: "让小悦帮你找到同频的人 🎯",
    description: "AI智能匹配，为你推荐气场相合的活动和朋友，告别无效社交~"
  },
  {
    icon: Calendar,
    title: "参加精致小聚 🎊",
    description: "5-10人精选局，在温馨安全的空间里，遇见志同道合的新朋友~"
  },
  {
    icon: MessageCircle,
    title: "建立真实连接 💫",
    description: "从陌生到熟悉，发现你的本地社群，收获有意义的友谊~"
  }
];

export default function HowItWorks() {
  return (
    <section className="py-16" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              如何开始？
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              四步开启你的社交新旅程 ✨
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <Card key={i} className="relative border-0 bg-card/50">
                <CardContent className="pt-6">
                  <div className="absolute -top-4 left-6 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mt-2">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
