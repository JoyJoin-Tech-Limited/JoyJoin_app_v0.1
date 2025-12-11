import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Brain, Gift, Smile, ChevronDown } from "lucide-react";
import { SiWechat } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AREA_CODES = [
  { code: "+86", country: "中国大陆", flag: "🇨🇳" },
  { code: "+852", country: "香港", flag: "🇭🇰" },
  { code: "+853", country: "澳门", flag: "🇲🇴" },
  { code: "+886", country: "台湾", flag: "🇹🇼" },
];

function detectDefaultAreaCode(): string {
  const lang = navigator.language?.toLowerCase() || "";
  const languages = navigator.languages?.map(l => l.toLowerCase()) || [];
  
  if (lang.includes("zh-tw") || languages.some(l => l.includes("zh-tw"))) {
    return "+886";
  }
  
  if (lang.includes("zh-hk") || languages.some(l => l.includes("zh-hk"))) {
    return "+852";
  }
  
  if (lang.includes("zh-mo") || languages.some(l => l.includes("zh-mo"))) {
    return "+853";
  }
  
  return "+86";
}

export default function LoginPage() {
  const { toast } = useToast();
  const [areaCode, setAreaCode] = useState("+86");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const detectedCode = detectDefaultAreaCode();
    setAreaCode(detectedCode);
  }, []);

  const sendCodeMutation = useMutation({
    mutationFn: async (phone: string) => {
      return await apiRequest("POST", "/api/auth/send-code", { phoneNumber: phone });
    },
    onSuccess: () => {
      setCodeSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      toast({
        title: "验证码已发送",
        description: "请查收短信验证码",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; code: string }) => {
      return await apiRequest("POST", "/api/auth/phone-login", data);
    },
    onSuccess: async () => {
      // 🎯 DEMO: 自动生成演示活动数据
      try {
        await apiRequest("POST", "/api/demo/seed-events", {});
        console.log("✅ Demo events seeded");
      } catch (error) {
        console.log("Demo events may already exist:", error);
      }
      
      // Check for pending invitation
      const pendingInviteCode = localStorage.getItem('pending_invitation_code');
      if (pendingInviteCode) {
        toast({
          title: "登录成功",
          description: "正在处理邀请...",
        });
        // Clear cache and redirect to invitation page
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        window.location.href = `/invite/${pendingInviteCode}`;
        return;
      }
      
      toast({
        title: "登录成功",
        description: "欢迎回来！",
      });
      
      // 清除缓存，触发useAuth重新获取用户数据，App.tsx会自动重定向
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "登录失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPhoneLength = () => {
    if (areaCode === "+86") return 11;
    if (areaCode === "+852" || areaCode === "+853") return 8;
    if (areaCode === "+886") return 10;
    return 11;
  };

  const handleSendCode = () => {
    const expectedLength = getPhoneLength();
    if (!phoneNumber || phoneNumber.length !== expectedLength) {
      toast({
        title: "手机号格式错误",
        description: `请输入${expectedLength}位手机号`,
        variant: "destructive",
      });
      return;
    }
    const fullPhone = `${areaCode}${phoneNumber}`;
    sendCodeMutation.mutate(fullPhone);
  };

  const handleLogin = () => {
    if (!phoneNumber || !verificationCode) {
      toast({
        title: "信息不完整",
        description: "请输入手机号和验证码",
        variant: "destructive",
      });
      return;
    }
    const fullPhone = `${areaCode}${phoneNumber}`;
    loginMutation.mutate({ phoneNumber: fullPhone, code: verificationCode });
  };

  const handleWeChatLogin = () => {
    toast({
      title: "微信登录",
      description: "微信授权登录功能开发中，敬请期待",
    });
  };

  const features = [
    {
      icon: <Users className="h-6 w-6" />,
      title: "4-6人精品小局",
      subtitle: "神秘饭局 · 深度社交",
      description: "小而美的聚会，真正的深度交流",
      color: "from-purple-500 to-purple-600",
      delay: 0.1,
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI智能匹配",
      subtitle: "8维画像 · 精准连接 · 志趣相投",
      description: "基于兴趣、性格、话题的智能匹配",
      color: "from-blue-500 to-blue-600",
      delay: 0.2,
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: "神秘盲盒体验",
      subtitle: "翻卡解锁 · 惊喜相遇 · 每次都是新冒险",
      description: "充满期待的社交探险",
      color: "from-pink-500 to-pink-600",
      delay: 0.3,
    },
    {
      icon: <Smile className="h-6 w-6" />,
      title: "包开心有趣",
      subtitle: "轻松氛围 · 愉悦体验 · 笑声不断",
      description: "让每次聚会都充满欢乐",
      color: "from-orange-500 to-orange-600",
      delay: 0.4,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 flex items-center justify-center shadow-lg">
              <span className="text-4xl">🎪</span>
            </div>
          </div>
          
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            悦聚·Joy
          </h1>
          
          <p className="text-lg font-medium text-primary px-6 leading-relaxed">
            探索港深奇遇，邂逅有趣灵魂
          </p>
        </motion.div>

        {/* Highlights Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          {/* Featured Card - 4-6人精品小局 */}
          <Card className="border-2 border-primary shadow-lg overflow-hidden">
            <CardContent className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="text-center space-y-3">
                <Badge className="bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold">
                  核心特色
                </Badge>
                <div className="text-2xl font-bold">4-6人精品小局</div>
                <p className="text-sm font-medium text-muted-foreground">
                  神秘饭局 · 深度社交 · 小而美的聚会
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Other Features */}
          <div className="space-y-3">
            {features.slice(1).map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: feature.delay }}
              >
                <Card className="border hover-elevate transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white flex-shrink-0`}>
                        {feature.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {feature.subtitle}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="border shadow-lg">
            <CardContent className="p-6 space-y-5">
              {/* WeChat Login */}
              <Button
                size="lg"
                className="w-full bg-[#07C160] hover:bg-[#06AD56] text-white border-0"
                onClick={handleWeChatLogin}
                data-testid="button-wechat-login"
              >
                <SiWechat className="h-5 w-5 mr-2" />
                微信一键登录
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">或使用手机号登录</span>
                </div>
              </div>

              {/* Phone Number Login */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">手机号</Label>
                  <div className="flex gap-2">
                    <Select value={areaCode} onValueChange={setAreaCode}>
                      <SelectTrigger className="w-[110px] h-11" data-testid="select-area-code">
                        <SelectValue>
                          {AREA_CODES.find(a => a.code === areaCode)?.flag} {areaCode}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {AREA_CODES.map((area) => (
                          <SelectItem key={area.code} value={area.code}>
                            <span className="flex items-center gap-2">
                              <span>{area.flag}</span>
                              <span>{area.code}</span>
                              <span className="text-muted-foreground text-xs">{area.country}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={`请输入${getPhoneLength()}位手机号`}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, getPhoneLength()))}
                      maxLength={getPhoneLength()}
                      className="h-11 flex-1"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      type="text"
                      placeholder="请输入验证码"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="h-11"
                      data-testid="input-code"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={countdown > 0 || sendCodeMutation.isPending}
                      className="min-w-[100px] h-11"
                      data-testid="button-send-code"
                    >
                      {countdown > 0 ? `${countdown}秒` : codeSent ? "重新发送" : "发送验证码"}
                    </Button>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full h-11"
                  onClick={handleLogin}
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "登录中..." : "登录"}
                </Button>
              </div>

              {/* Terms */}
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                登录即表示同意
                <a href="#" className="text-primary hover:underline ml-1">《用户协议》</a>
                和
                <a href="#" className="text-primary hover:underline">《隐私政策》</a>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center text-sm text-muted-foreground"
        >
          专注香港和深圳本地社交
        </motion.p>
      </div>
    </div>
  );
}
