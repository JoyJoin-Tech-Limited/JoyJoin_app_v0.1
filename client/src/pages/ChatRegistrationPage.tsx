import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, Bot, User, Sparkles, ArrowRight } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface CollectedInfo {
  displayName?: string;
  gender?: string;
  birthYear?: number;
  currentCity?: string;
  occupationDescription?: string;
  interestsTop?: string[];
  primaryInterests?: string[];
  venueStylePreference?: string;
  topicAvoidances?: string[];
  socialStyle?: string;
}

export default function ChatRegistrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/registration/chat/start");
      return res.json();
    },
    onSuccess: (data) => {
      setMessages([{
        role: "assistant",
        content: data.message,
        timestamp: new Date()
      }]);
      setConversationHistory(data.conversationHistory);
    },
    onError: () => {
      toast({
        title: "连接失败",
        description: "无法连接小悦，请稍后再试",
        variant: "destructive"
      });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/registration/chat/message", {
        message,
        conversationHistory
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message,
        timestamp: new Date()
      }]);
      setConversationHistory(data.conversationHistory);
      if (data.collectedInfo) {
        setCollectedInfo(prev => ({ ...prev, ...data.collectedInfo }));
      }
      if (data.isComplete) {
        setIsComplete(true);
      }
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast({
        title: "发送失败",
        description: "小悦暂时走神了，请重试",
        variant: "destructive"
      });
    }
  });

  const submitRegistrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/registration/chat/complete", {
        conversationHistory,
        collectedInfo
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "注册成功",
        description: "欢迎加入 JoyJoin！"
      });
      setLocation("/interests-topics");
    },
    onError: () => {
      toast({
        title: "提交失败",
        description: "请稍后再试",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    startChatMutation.mutate();
  }, []);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, {
      role: "user",
      content: userMessage,
      timestamp: new Date()
    }]);
    setInputValue("");
    setIsTyping(true);
    sendMessageMutation.mutate(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComplete = () => {
    submitRegistrationMutation.mutate();
  };

  const infoCount = Object.keys(collectedInfo).filter(k => 
    collectedInfo[k as keyof CollectedInfo] !== undefined
  ).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MobileHeader title="和小悦聊聊" action={
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setLocation("/registration/form")}
          data-testid="button-switch-to-form"
        >
          切换到表单
        </Button>
      } />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant" 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted"
              }`}>
                {msg.role === "assistant" ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <Card className={`max-w-[80%] p-3 ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <Card className="bg-muted p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </Card>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {infoCount > 0 && (
        <div className="px-4 py-2 bg-muted/50 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>已收集 {infoCount} 项信息</span>
          </div>
        </div>
      )}

      {isComplete ? (
        <div className="p-4 border-t bg-background">
          <Button 
            className="w-full" 
            onClick={handleComplete}
            disabled={submitRegistrationMutation.isPending}
            data-testid="button-complete-registration"
          >
            {submitRegistrationMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            继续下一步
          </Button>
        </div>
      ) : (
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              disabled={isTyping || startChatMutation.isPending}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              data-testid="button-send-message"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
