/**
 * SocialTagSelectionCard - Interactive card for selecting social personality tags
 * 
 * Features:
 * - Auto-generates 2-3 tag options on mount
 * - Displays tags in card format with gradient backgrounds
 * - Allows user to select one tag
 * - Provides regenerate functionality
 * - Handles loading/error states gracefully
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SocialTagSelectionCardProps {
  archetype: string;
  profession?: {
    industry?: string;
    occupationId?: string;
    workMode?: string;
  };
  hobbies?: Array<{ name: string; heat: number }>;
}

interface GeneratedTag {
  descriptor: string;
  archetypeNickname: string;
  fullTag: string;
  reasoning: string;
}

const GRADIENT_COLORS = [
  "from-purple-500 to-violet-600",
  "from-pink-500 to-rose-600",
  "from-blue-500 to-indigo-600",
];

export function SocialTagSelectionCard({ 
  archetype, 
  profession, 
  hobbies 
}: SocialTagSelectionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch generated tags
  const { data: tagsData, isLoading, error, refetch } = useQuery<{
    tags: GeneratedTag[];
    isFallback?: boolean;
    cached?: boolean;
  }>({
    queryKey: ['/api/user/social-tags/generate', archetype],
    queryFn: async () => {
      const response = await fetch('/api/user/social-tags/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archetype, profession, hobbies }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate tags');
      }

      return response.json();
    },
    enabled: !!archetype,
  });

  // Select tag mutation
  const selectTagMutation = useMutation({
    mutationFn: async (data: { tagIndex: number; fullTag: string }) => {
      const response = await fetch('/api/user/social-tags/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to select tag');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "标签已保存 ✨",
        description: "你的社交标签将显示在个人资料中",
      });
      
      // Invalidate user cache
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: () => {
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  // Handle tag selection
  const handleSelectTag = (index: number, tag: GeneratedTag) => {
    setSelectedIndex(index);
    selectTagMutation.mutate({
      tagIndex: index,
      fullTag: tag.fullTag,
    });
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setSelectedIndex(null);
    
    try {
      await refetch();
      toast({
        title: "标签已刷新 🔄",
        description: "为你生成了新的标签选项",
      });
    } catch (error) {
      toast({
        title: "刷新失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI 正在为你生成专属标签
          </CardTitle>
          <CardDescription>
            基于你的性格、职业和兴趣
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="font-medium">生成标签失败</p>
              <p className="text-sm text-red-600">请稍后重试或联系客服</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tags = tagsData?.tags || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            选择你的社交标签
          </CardTitle>
          <CardDescription>
            这个标签将作为你的社交身份标识，显示在个人资料和活动匹配中
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Tag Options */}
          <AnimatePresence mode="wait">
            <div className="space-y-3">
              {tags.map((tag, index) => (
                <motion.div
                  key={`${tag.fullTag}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleSelectTag(index, tag)}
                  className={cn(
                    "relative p-4 rounded-lg cursor-pointer transition-all duration-300",
                    "hover:scale-[1.02] hover:shadow-lg",
                    selectedIndex === index
                      ? "ring-4 ring-purple-400 shadow-xl"
                      : "hover:ring-2 hover:ring-purple-200",
                    "bg-gradient-to-r",
                    GRADIENT_COLORS[index % GRADIENT_COLORS.length]
                  )}
                >
                  {/* Selected check mark */}
                  {selectedIndex === index && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md"
                    >
                      <Check className="w-5 h-5 text-purple-600" />
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <div className="text-white">
                      <h3 className="text-xl font-bold">{tag.fullTag}</h3>
                      <p className="text-sm opacity-90 mt-1">{tag.reasoning}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {tag.descriptor}
                      </Badge>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {tag.archetypeNickname}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {/* Regenerate Button */}
          <div className="flex items-center justify-center pt-4 border-t border-purple-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRegenerating && "animate-spin")} />
              不太满意？换一批标签
            </Button>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 p-3 bg-purple-100 rounded-lg text-sm text-purple-800">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              💡 提示：选中的标签将显示在你的个人资料和活动匹配中，帮助其他人更快地了解你的风格
            </p>
          </div>

          {/* Fallback indicator */}
          {tagsData?.isFallback && (
            <p className="text-xs text-center text-muted-foreground">
              使用智能算法生成
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
