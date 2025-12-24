import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Volume2, Phone } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface VoiceQuizProps {
  onComplete: (results: any) => void;
  onSkip?: () => void;
  coachGender: "female" | "male";
}

const CONVERSATION_FLOW = [
  {
    id: 1,
    coachPrompt: {
      female: "嗨！让我们开始吧。先聊聊你的周末，你最喜欢怎么度过空闲时光？",
      male: "嘿！我们开始吧。周末的时候你一般喜欢干什么？"
    }
  },
  {
    id: 2,
    coachPrompt: {
      female: "听起来不错！那遇到新朋友的时候，你是主动开聊的那个，还是比较慢热？",
      male: "有意思。碰到陌生人的时候，你是那种主动搭话的类型吗？"
    }
  },
  {
    id: 3,
    coachPrompt: {
      female: "明白了。你是喜欢把事情安排得明明白白，还是更享受说走就走的感觉？",
      male: "了解。你做事喜欢提前规划，还是随机应变？"
    }
  },
  {
    id: 4,
    coachPrompt: {
      female: "嗯嗯。如果朋友来找你吐槽烦心事，你会怎么回应？",
      male: "知道了。朋友找你聊问题的时候，你一般怎么处理？"
    }
  },
  {
    id: 5,
    coachPrompt: {
      female: "最后一个问题啦！什么事情能真正点燃你的热情，让你特别有动力？",
      male: "最后问一个！什么东西最能让你兴奋起来？"
    }
  }
];

export default function VoiceQuiz({ onComplete, onSkip, coachGender }: VoiceQuizProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCoachSpeaking, setIsCoachSpeaking] = useState(false);
  const [coachAudioTime, setCoachAudioTime] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [canRecord, setCanRecord] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const coachTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const coachName = coachGender === "female" ? "小周" : "Ben";
  const coachGreeting = coachGender === "female" 
    ? "你好，我是你的好姐妹小周" 
    : "你好，我是你的好兄弟Ben";

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (coachTimerRef.current) clearInterval(coachTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!showIntro && currentStep < CONVERSATION_FLOW.length) {
      playCoachPrompt();
    }
  }, [currentStep, showIntro]);

  const playCoachPrompt = async () => {
    const step = CONVERSATION_FLOW[currentStep];
    const prompt = step.coachPrompt[coachGender];
    
    setIsCoachSpeaking(true);
    setCoachAudioTime(0);
    setCanRecord(false);
    
    const estimatedDuration = Math.min(6, prompt.length * 0.08);
    
    coachTimerRef.current = setInterval(() => {
      setCoachAudioTime(prev => {
        if (prev >= estimatedDuration) {
          if (coachTimerRef.current) clearInterval(coachTimerRef.current);
          setIsCoachSpeaking(false);
          setCanRecord(true);
          return estimatedDuration;
        }
        return prev + 0.1;
      });
    }, 100);
  };

  const startIntro = () => {
    setShowIntro(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setCanRecord(false);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResponse = `用户的回答 ${currentStep + 1}`;
      const newResponses = [...responses, mockResponse];
      setResponses(newResponses);

      if (currentStep < CONVERSATION_FLOW.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        await analyzeResponses(newResponses);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      alert('处理音频时出错，请重试');
      setCanRecord(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeResponses = async (allResponses: string[]) => {
    setIsProcessing(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results = {
        traits: [
          { name: "亲和力", score: 8, maxScore: 10 },
          { name: "开放性", score: 7, maxScore: 10 },
          { name: "责任心", score: 6, maxScore: 10 },
          { name: "外向性", score: 5, maxScore: 10 },
          { name: "情绪稳定性", score: 8, maxScore: 10 }
        ],
        challenges: [
          "可能对突然的计划变更感到不适应",
          "在大型社交场合中可能需要独处时间恢复能量"
        ],
        idealMatch: "你会在与同样重视深度对话、欣赏计划性活动但也能享受偶尔即兴时刻的朋友相处中感到愉快。寻找那些能理解你需要独处时间、同时也享受有意义社交互动的人。",
        energyLevel: 75
      };

      onComplete(results);
    } finally {
      setIsProcessing(false);
    }
  };

  if (showIntro) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-6 min-h-[400px]">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center">
              <Phone className="h-12 w-12 text-primary" />
            </div>
            <div className="absolute -inset-2 rounded-full bg-primary/10 animate-pulse" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-display font-bold">{coachName} 教练</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {coachGreeting}。接下来就像打电话聊天一样，我问你答，很轻松！
            </p>
          </div>

          <Button 
            size="lg"
            onClick={startIntro}
            data-testid="button-start-with-coach"
            className="mt-4"
          >
            开始语音通话
          </Button>

          {onSkip && (
            <Button 
              variant="ghost"
              onClick={onSkip}
              data-testid="button-skip-coach"
            >
              跳过语音引导
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const step = CONVERSATION_FLOW[currentStep];
  const progress = ((currentStep + (isProcessing ? 1 : 0)) / CONVERSATION_FLOW.length) * 100;

  if (isProcessing) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-4 min-h-[500px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground text-center">
            {currentStep === CONVERSATION_FLOW.length - 1 
              ? "正在分析您的性格特质..." 
              : "理解中..."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>问题 {currentStep + 1} / {CONVERSATION_FLOW.length}</span>
        <span>{Math.round(progress)}%</span>
      </div>

      <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent min-h-[500px] flex flex-col">
        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isCoachSpeaking ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
              <span className="text-sm font-medium">{coachName}</span>
            </div>
            {isCoachSpeaking && (
              <Badge variant="secondary" className="gap-1.5 text-xs">
                <Volume2 className="h-3 w-3" />
                {coachAudioTime.toFixed(1)}s
              </Badge>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center space-y-8">
            <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
              {isCoachSpeaking ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-32 w-48 rounded-full border-4 border-primary/40" 
                         style={{ 
                           transform: `scale(${1 + Math.sin(coachAudioTime * 3) * 0.1})`,
                           transition: 'transform 0.1s ease-out'
                         }} 
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-56 rounded-full border-2 border-primary/20" 
                         style={{ 
                           transform: `scale(${1 + Math.sin(coachAudioTime * 3 + 0.5) * 0.15})`,
                           transition: 'transform 0.1s ease-out'
                         }} 
                    />
                  </div>
                </>
              ) : isRecording ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-32 w-48 rounded-full border-4 border-destructive/40" 
                         style={{ 
                           transform: `scale(${1 + Math.sin(recordingTime * 2) * 0.08})`,
                           transition: 'transform 0.1s ease-out'
                         }} 
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-56 rounded-full border-2 border-destructive/20" 
                         style={{ 
                           transform: `scale(${1 + Math.sin(recordingTime * 2 + 0.5) * 0.12})`,
                           transition: 'transform 0.1s ease-out'
                         }} 
                    />
                  </div>
                </>
              ) : (
                <div className="h-32 w-48 rounded-full border-4 border-muted" />
              )}
            </div>

            <div className="text-center space-y-3 w-full px-4">
              <p className="text-base font-medium">
                {step.coachPrompt[coachGender]}
              </p>
              {canRecord && !isRecording && (
                <p className="text-xs text-muted-foreground">
                  点击麦克风回答
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center space-y-4 pt-4 mt-auto">
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "default"}
              className="h-20 w-20 rounded-full"
              onClick={toggleRecording}
              disabled={isCoachSpeaking || isProcessing}
              data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
            >
              {isRecording ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
            
            <div className="text-center">
              {isCoachSpeaking ? (
                <p className="text-xs text-muted-foreground">教练说话中...</p>
              ) : isRecording ? (
                <Badge variant="destructive" className="gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  录音中 {recordingTime}s
                </Badge>
              ) : canRecord ? (
                <p className="text-xs text-muted-foreground">按住麦克风说话，松开结束</p>
              ) : (
                <p className="text-xs text-muted-foreground">等待中...</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
