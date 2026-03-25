/**
 * ShareCardModal Component
 * Modal for selecting color variants and sharing personality test result cards
 * 
 * Design System:
 * - Spacing: gap-2.5 (10px), gap-3 (12px), mb-4 (16px), mt-6 (24px), px-2 (8px)
 * - Font Sizes: text-sm (14px), text-base (16px), text-lg (18px), text-xl (20px)
 * - Border Radius: rounded-xl (12px), rounded-2xl (16px)
 * - Mobile-first: Responsive padding and spacing for 375px-428px viewports
 * - Performance: Uses useMemo for expensive computations, reduced animation durations
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PokemonShareCard } from "./PokemonShareCard";
import { getArchetypeVariants, type ShareCardVariant } from "@/lib/archetypeShareVariants";
import { archetypeAvatars, getArchetypeAvatar, hasExpressionAsset } from "@/lib/archetypeAdapter";
import { Share2, Download, Loader2, Check } from "lucide-react";
import html2canvas from "html2canvas";
import { haptics } from "@/lib/haptics";

interface ShareCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Type for share card data from API
interface ShareCardData {
  archetype: string;
  gradient: string;
  primaryColor: string;
  illustrationUrl: string;
  rankings: {
    totalUserRank: number;
    archetypeRank: number;
  };
  traitScores: {
    A: number;
    O: number;
    C: number;
    E: number;
    X: number;
    P: number;
  };
}

// Expression options for archetype customization
const expressionOptions = [
  { id: "starry", label: "星星眼", emoji: "🤩" },
  { id: "hearts", label: "爱心眼", emoji: "😍" },
  { id: "shy", label: "害羞", emoji: "😳" },
  { id: "shocked", label: "震惊", emoji: "😲" },
];

// English name mapping for archetypes
const archetypeEnglishNames: Record<string, string> = {
  "机智狐": "Clever Fox",
  "开心柯基": "Happy Corgi",
  "暖心熊": "Warm Bear",
  "织网蛛": "Weaver Spider",
  "夸夸豚": "Cheerful Dolphin",
  "太阳鸡": "Sunny Rooster",
  "淡定海豚": "Calm Dolphin",
  "沉思猫头鹰": "Thoughtful Owl",
  "稳如龟": "Steady Turtle",
  "隐身猫": "Mysterious Cat",
  "定心大象": "Grounded Elephant",
  "灵感章鱼": "Creative Octopus"
};

export function ShareCardModal({ open, onOpenChange }: ShareCardModalProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedExpression, setSelectedExpression] = useState("starry");
  const [nickname, setNickname] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Reset selected variant and expression when modal opens (but keep nickname)
  useEffect(() => {
    if (open) {
      setSelectedVariantIndex(0);
      setSelectedExpression("starry");
      setIsPreviewMode(true);
      setIsFlipped(false);
      // Don't reset nickname - let user keep their previous input
    }
  }, [open]);

  // Fetch share card data
  const { data: shareCardData, isLoading, isError } = useQuery<ShareCardData>({
    queryKey: ['/api/personality-test/share-card-data'],
    enabled: open,
    retry: false,
  });

  const archetype = shareCardData?.archetype || "";
  const variants = getArchetypeVariants(archetype);
  const selectedVariant = variants[selectedVariantIndex] || variants[0];
  
  // Memoize illustration URL to reduce re-renders
  const illustrationUrl = useMemo(
    () => getArchetypeAvatar(archetype, selectedExpression) || archetypeAvatars[archetype] || "",
    [archetype, selectedExpression]
  );
  
  // Check if we have a dedicated expression asset (to determine if emoji overlay is needed)
  const hasExpressionVariant = useMemo(
    () => hasExpressionAsset(archetype, selectedExpression),
    [archetype, selectedExpression]
  );

  // Safety check for variants
  if (variants.length === 0 && shareCardData) {
    console.error(`No variants found for archetype: ${archetype}`);
  }

  // Generate image from card
  const generateImage = useCallback(async (): Promise<string | null> => {
    if (!cardRef.current) return null;

    // Check browser support
    if (typeof window === 'undefined' || !window.HTMLCanvasElement) {
      toast({
        title: "不支持的浏览器",
        description: "当前浏览器不支持图片生成功能",
        variant: "destructive",
      });
      return null;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      
      // Ensure card is flipped to front before capturing
      setIsFlipped(false);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 1: Disable animations (20%)
      setIsPreviewMode(false);
      setGenerationProgress(20);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 2: Wait for fonts to load (40%)
      setGenerationProgress(40);
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Step 3: Capture with high quality settings (60%)
      setGenerationProgress(60);
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // High resolution
        backgroundColor: null,
        logging: false,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false, // Better SVG support for radar chart
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Force disable all animations in cloned document
          const cardElement = clonedDoc.querySelector('[data-card-root]');
          if (cardElement) {
            (cardElement as HTMLElement).style.animation = 'none';
            (cardElement as HTMLElement).style.transition = 'none';
            
            // Also disable framer-motion animations
            const motionElements = clonedDoc.querySelectorAll('[data-framer-motion]');
            motionElements.forEach(el => {
              (el as HTMLElement).style.animation = 'none';
              (el as HTMLElement).style.transition = 'none';
            });
          }
        }
      });
      
      // Step 4: Convert to data URL (80%)
      setGenerationProgress(80);
      const dataUrl = canvas.toDataURL('image/png', 1.0); // Max quality
      
      // Step 5: Complete (100%)
      setGenerationProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Re-enable preview mode
      setIsPreviewMode(true);
      setGenerationProgress(0);

      return dataUrl;
      
    } catch (error) {
      console.error('Failed to generate image:', error);
      
      // Auto-retry once with lower quality
      if (!isRetrying) {
        console.log('Retrying with fallback settings...');
        setIsRetrying(true);
        
        try {
          setGenerationProgress(50);
          const canvas = await html2canvas(cardRef.current, {
            scale: 2, // Lower quality fallback
            backgroundColor: null,
            logging: false,
            useCORS: true,
          });
          
          setGenerationProgress(100);
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          
          setIsPreviewMode(true);
          setIsRetrying(false);
          setGenerationProgress(0);
          
          toast({
            title: "生成成功",
            description: "使用了兼容模式生成图片",
          });
          
          return dataUrl;
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          
          // Retry failed: show error toast and clean up state explicitly
          toast({
            title: "生成失败",
            description: "无法生成分享卡片，请重试",
            variant: "destructive",
          });
          
          setIsPreviewMode(true);
          setIsRetrying(false);
          setGenerationProgress(0);
          return null;
        }
      }
      
      // This should not be reached if retry succeeded
      toast({
        title: "生成失败",
        description: "无法生成分享卡片，请重试",
        variant: "destructive",
      });
      
      setIsPreviewMode(true);
      setIsRetrying(false);
      setGenerationProgress(0);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [toast, isRetrying]);

  // Handle share
  const handleShare = useCallback(async () => {
    const imageDataUrl = await generateImage();
    if (!imageDataUrl) return;

    const filename = `悦聚-${archetype}-性格卡.png`;

    // Try native share API first (mobile)
    if (navigator.share && navigator.canShare) {
      try {
        // Convert data URL to blob
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `我是${archetype}！`,
            text: `我在悦聚完成了性格测试，发现自己是${archetype}！快来看看你是什么性格吧～`,
          });

          toast({
            title: "分享成功！",
            description: "卡片已分享",
          });
          return;
        }
      } catch (error) {
        console.error('Native share failed:', error);
      }
    }

    // Fallback: download + copy text
    const link = document.createElement('a');
    link.download = filename;
    link.href = imageDataUrl;
    link.click();

    // Copy share text to clipboard
    try {
      await navigator.clipboard.writeText(
        `我在悦聚完成了性格测试，发现自己是${archetype}！快来看看你是什么性格吧～`
      );
      toast({
        title: "已保存图片！",
        description: "分享文案已复制到剪贴板",
      });
    } catch {
      toast({
        title: "已保存图片！",
        description: "可手动分享到社交媒体",
      });
    }
  }, [generateImage, archetype, toast]);

  // Handle download
  const handleDownload = useCallback(async () => {
    const imageDataUrl = await generateImage();
    if (!imageDataUrl) return;

    const filename = `悦聚-${archetype}-性格卡.png`;

    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      // Track download method for analytics
      let downloadMethod: string;

      // Try native share API first (mobile preferred)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `我是${archetype}！`,
              text: `我在悦聚完成了性格测试，发现自己是${archetype}！`
            });
            
            downloadMethod = 'native_share';
            
            // Analytics tracking
            if (window.gtag) {
              window.gtag('event', 'share_card_download', {
                method: downloadMethod,
                archetype: archetype,
                expression: selectedExpression,
                variant: selectedVariant.name
              });
            }
            
            toast({
              title: "分享成功！",
              description: "性格卡已分享"
            });
            return;
          } catch (shareError) {
            // User cancelled share, fall through to download
            console.log('Share cancelled:', shareError);
          }
        }
      }

      // Fallback: Blob URL download
      downloadMethod = 'blob_download';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after download with a safer delay
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      // Analytics tracking
      if (window.gtag) {
        window.gtag('event', 'share_card_download', {
          method: downloadMethod,
          archetype: archetype,
          expression: selectedExpression,
          variant: selectedVariant.name
        });
      }

      toast({
        title: "下载成功！",
        description: "图片已保存到本地"
      });
      
    } catch (error) {
      console.error('Download failed:', error);
      
      // Analytics - track failures
      if (window.gtag) {
        window.gtag('event', 'share_card_download_error', {
          error: (error as Error).message
        });
      }
      
      toast({
        title: "下载失败",
        description: "请稍后重试",
        variant: "destructive"
      });
    }
  }, [generateImage, archetype, selectedExpression, selectedVariant, toast]);

  if (isError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>加载失败</DialogTitle>
            <DialogDescription>无法加载卡片数据</DialogDescription>
          </VisuallyHidden>
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <p className="text-muted-foreground text-sm">卡片数据加载失败，请登录后重试</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isLoading || !shareCardData || !selectedVariant) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>加载中</DialogTitle>
            <DialogDescription>正在准备你的专属卡片</DialogDescription>
          </VisuallyHidden>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] flex flex-col p-4 sm:p-6">
        <VisuallyHidden>
          <DialogTitle>分享你的专属氛围原型卡片</DialogTitle>
          <DialogDescription>
            选择卡片样式和表情，下载或分享你的个性化原型卡片到社交媒体
          </DialogDescription>
        </VisuallyHidden>
        
        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">分享你的专属氛围原型卡片</h2>
          </div>

          {/* Card flip container */}
          <div className="flex justify-center px-2 sm:px-0 pb-2">
            <div className="w-full max-w-[90vw] sm:max-w-full" style={{ perspective: "1000px" }}>
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ 
                  duration: 0.35, 
                  type: "spring", 
                  stiffness: 280, 
                  damping: 22 
                }}
                style={{ 
                  transformStyle: "preserve-3d",
                  position: "relative",
                  width: "100%",
                  aspectRatio: "3 / 5",
                }}
                className="relative"
              >
                {/* Front side - Card Preview */}
                <div
                  className="absolute inset-0"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden"
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${selectedVariantIndex}-${selectedExpression}`}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="h-full"
                    >
                      <PokemonShareCard
                        ref={cardRef}
                        archetype={archetype}
                        archetypeEnglish={archetypeEnglishNames[archetype] || archetype}
                        variant={selectedVariant}
                        illustrationUrl={illustrationUrl}
                        rankings={shareCardData.rankings}
                        traitScores={shareCardData.traitScores}
                        expression={selectedExpression}
                        nickname={nickname}
                        isPreview={isPreviewMode}
                        hasExpressionAsset={hasExpressionVariant}
                        shareDate={new Date().toISOString().split('T')[0]}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Back side - Customization */}
                <div
                  className="absolute inset-0"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)"
                  }}
                >
                  <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-2xl p-6 shadow-xl border-2 border-purple-200 h-full flex flex-col overflow-y-auto">
                    {/* Header with back button */}
                    <div className="flex items-center justify-between mb-6">
                      <Button
                        variant="ghost"
                        onClick={() => setIsFlipped(false)}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                      >
                        <span className="text-lg">←</span>
                        <span>返回</span>
                      </Button>
                      <h3 className="text-lg font-bold text-gray-800">定制你的卡片</h3>
                      <div className="w-20" /> {/* Spacer for centering */}
                    </div>

                    {/* Card ID input */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        昵称
                      </label>
                      <Input
                        type="text"
                        placeholder="输入你的昵称"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={20}
                        className="text-center text-base font-medium"
                      />
                      <p className="text-xs text-gray-500 text-center mt-1.5">
                        显示在卡片上
                      </p>
                    </div>

                    {/* Expression selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        表情选择
                      </label>
                      <div className="grid grid-cols-4 gap-2.5">
                        {expressionOptions.map((expr) => {
                          const expressionImageUrl = getArchetypeAvatar(archetype, expr.id) || illustrationUrl;
                          return (
                            <motion.button
                              key={expr.id}
                              onClick={() => setSelectedExpression(expr.id)}
                              className={`
                                relative aspect-square rounded-xl overflow-hidden
                                transition-all duration-150
                                ${selectedExpression === expr.id
                                  ? 'ring-4 ring-primary shadow-lg scale-105'
                                  : 'ring-2 ring-gray-200 hover:ring-gray-300'}
                              `}
                              whileTap={{ scale: 0.95 }}
                            >
                              {/* Fallback emoji background (shown if image fails or is identical) */}
                              <div className="flex h-full w-full items-center justify-center text-3xl bg-gray-100">
                                {expr.emoji}
                              </div>
                              {/* Archetype expression image overlay (if different from base) */}
                              <img 
                                src={expressionImageUrl}
                                alt={expr.label}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              {/* Label overlay */}
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent py-1">
                                <span className="text-xs text-white font-medium block text-center">{expr.label}</span>
                              </div>
                              {selectedExpression === expr.id && (
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Background color selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        背景配色
                      </label>
                      <div className="grid grid-cols-4 gap-2.5">
                        {variants.map((variant, index) => (
                          <motion.button
                            key={variant.name}
                            onClick={() => setSelectedVariantIndex(index)}
                            className={`
                              relative aspect-square rounded-xl overflow-hidden
                              transition-all duration-150
                              ${selectedVariantIndex === index
                                ? 'ring-4 ring-primary scale-105 shadow-lg'
                                : 'ring-2 ring-gray-200 hover:ring-gray-300'}
                            `}
                            whileTap={{ scale: 0.95 }}
                          >
                            <div className={`w-full h-full bg-gradient-to-br ${variant.gradient}`} />
                            {selectedVariantIndex === index && (
                              <div className="absolute inset-0 bg-white/30 flex items-center justify-center">
                                <Check className="w-6 h-6 text-white drop-shadow-lg" />
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Confirm button - closer to content */}
                    <div className="mt-6">
                      <Button
                        onClick={() => setIsFlipped(false)}
                        className="w-full py-4 text-base font-semibold bg-primary hover:bg-primary/90 rounded-xl transition-all"
                      >
                        确认定制
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* PRIMARY ACTION: "定制卡片" Button - Placed right after card preview */}
          {!isFlipped && (
            <div className="mt-6 px-2 sm:px-0">
              <motion.button
                onClick={() => {
                  haptics.medium();
                  setIsFlipped(true);
                }}
                disabled={isGenerating}
                className="relative w-full h-14 rounded-2xl overflow-hidden shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ y: 0.5, scale: 0.99 }}
                role="button"
                aria-label="定制卡片"
              >
                {/* 3D Shadow Layer */}
                <div className="absolute inset-0 bg-gradient-to-b from-purple-700 via-pink-700 to-purple-800 translate-y-1 rounded-2xl" />
                
                {/* Main Button Layer */}
                <div className="relative h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 rounded-2xl flex items-center justify-center gap-2 px-4">
                  {/* Animated shimmer overlay */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    style={{ width: '200%', willChange: 'transform' }}
                    animate={open && !isGenerating ? { x: ['-100%', '200%'] } : { x: 0 }}
                    transition={open && !isGenerating ? { 
                      duration: 2.5, 
                      repeat: Infinity, 
                      repeatDelay: 1,
                      ease: "easeInOut"
                    } : { duration: 0 }}
                  />
                  
                  {/* Button content */}
                  <span className="relative text-xl drop-shadow-lg">✨</span>
                  <span className="relative text-base font-bold text-white drop-shadow-lg tracking-wide">
                    定制你的专属卡片
                  </span>
                </div>
              </motion.button>
            </div>
          )}
        </div>
        
        {/* Fixed bottom bar - no negative margins needed */}
        {!isFlipped && (
          <div className="flex-shrink-0 pt-4 pb-6 border-t border-gray-100 safe-area-pb">
            {/* Progress bar - only during generation */}
            {isGenerating && generationProgress > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>生成高质量图片中...</span>
                    <span className="font-bold">{generationProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${generationProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* SECONDARY: Share & Download Buttons */}
            <div className="flex gap-3 justify-center">
                {/* Share Button - Glass morphism */}
                <motion.button
                  onClick={() => {
                    haptics.light();
                    void handleShare();
                  }}
                  disabled={isGenerating}
                  className="group relative w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-md border-2 border-gray-200 shadow-lg disabled:opacity-50"
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  role="button"
                  aria-label="分享卡片"
                >
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200" />
                  
                  {isGenerating ? (
                    <Loader2 className="relative w-6 h-6 animate-spin mx-auto text-gray-600" />
                  ) : (
                    <>
                      <Share2 className="relative w-6 h-6 mx-auto text-blue-600 group-hover:scale-110 group-active:scale-110 group-focus-visible:scale-110 transition-transform" />
                      {/* Success checkmark badge - only show on larger screens with hover */}
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full hidden md:flex md:opacity-0 md:group-hover:opacity-100 items-center justify-center shadow-md transition-opacity">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                </motion.button>
                
                {/* Download Button - Glass morphism */}
                <motion.button
                  onClick={() => {
                    haptics.light();
                    void handleDownload();
                  }}
                  disabled={isGenerating}
                  className="group relative w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-md border-2 border-gray-200 shadow-lg disabled:opacity-50"
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  role="button"
                  aria-label="下载图片"
                >
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200" />
                  
                  {isGenerating ? (
                    <Loader2 className="relative w-6 h-6 animate-spin mx-auto text-gray-600" />
                  ) : (
                    <>
                      <Download className="relative w-6 h-6 mx-auto text-purple-600 group-hover:scale-110 group-active:scale-110 group-focus-visible:scale-110 transition-transform" />
                      {/* Success checkmark badge - only show on larger screens with hover */}
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full hidden md:flex md:opacity-0 md:group-hover:opacity-100 items-center justify-center shadow-md transition-opacity">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                </motion.button>
              </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
