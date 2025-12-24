import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, ClipboardList, Sparkles, Clock, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";

export default function RegistrationMethodPage() {
  const [, setLocation] = useLocation();

  const methods = [
    {
      id: "chat",
      title: "和小悦聊聊",
      subtitle: "轻松对话，2-3分钟",
      description: "像和朋友聊天一样完成注册，更自然有趣",
      icon: MessageCircle,
      badge: "推荐",
      badgeColor: "bg-primary text-primary-foreground",
      time: "2-3分钟",
      onClick: () => setLocation("/registration/chat"),
    },
    {
      id: "form",
      title: "快速填写",
      subtitle: "传统表单，1-2分钟",
      description: "直接填写表单，高效完成注册",
      icon: ClipboardList,
      badge: null,
      badgeColor: "",
      time: "1-2分钟",
      onClick: () => setLocation("/registration/form"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title="开始注册" />
      
      <div className="px-4 py-6 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">欢迎加入 JoyJoin</h1>
          <p className="text-muted-foreground">
            选择你喜欢的方式开始注册
          </p>
        </motion.div>

        <div className="space-y-4">
          {methods.map((method, index) => (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                onClick={method.onClick}
                data-testid={`card-registration-${method.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <method.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{method.title}</h3>
                        {method.badge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${method.badgeColor}`}>
                            {method.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {method.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{method.time}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          无论选择哪种方式，你的信息都将被安全保护
        </motion.p>
      </div>
    </div>
  );
}
