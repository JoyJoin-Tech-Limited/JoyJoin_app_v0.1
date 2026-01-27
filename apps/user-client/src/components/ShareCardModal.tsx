/**
 * ShareCardModal Component
 * Modal for selecting color variants and sharing personality test result cards
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PokemonShareCard } from "./PokemonShareCard";
import { getArchetypeVariants, type ShareCardVariant } from "@/lib/archetypeShareVariants";
import { archetypeAvatars, getArchetypeAvatar, hasExpressionAsset } from "@/lib/archetypeAdapter";
import { Share2, Download, Loader2, Check } from "lucide-react";
import html2canvas from "html2canvas";

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
  { id: "shy", label: "害羞可爱", emoji: "😳" },
  { id: "shocked", label: "震惊可爱", emoji: "😲" },
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
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Reset selected variant and expression when modal opens (but keep nickname)
  useEffect(() => {
    if (open) {
      setSelectedVariantIndex(0);
      setSelectedExpression("starry");
      setIsPreviewMode(true);
      // Don't reset nickname - let user keep their previous input
    }
  }, [open]);

  // Fetch share card data
  const { data: shareCardData, isLoading } = useQuery<ShareCardData>({
    queryKey: ['/api/personality-test/share-card-data'],
    enabled: open,
  });

  const archetype = shareCardData?.archetype || "";
  const variants = getArchetypeVariants(archetype);
  const selectedVariant = variants[selectedVariantIndex] || variants[0];
  // Use getArchetypeAvatar with expression support, fallback to archetypeAvatars for base
  const illustrationUrl = getArchetypeAvatar(archetype, selectedExpression) || archetypeAvatars[archetype] || "";
  // Check if we have a dedicated expression asset (to determine if emoji overlay is needed)
  const hasExpressionVariant = hasExpressionAsset(archetype, selectedExpression);

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
  }, [toast]);

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

  if (isLoading || !shareCardData || !selectedVariant) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">分享你的专属氛围原型卡片</h2>
          </div>

          {/* Card preview - moved before nickname input */}
          <div className="flex justify-center px-2 sm:px-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedVariantIndex}-${selectedExpression}`}
                initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.9, rotateY: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-[90vw] sm:max-w-full"
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

          {/* Progress bar during generation */}
          {isGenerating && generationProgress > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4"
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

          {/* Nickname input */}
          <div>
            <label htmlFor="nickname" className="block text-sm font-semibold text-gray-700 mb-2">
              你的昵称（可选）
            </label>
            <Input
              id="nickname"
              type="text"
              placeholder="输入你的昵称，让卡片更个性化"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="text-center text-lg font-medium"
            />
            <p className="text-xs text-gray-500 text-center mt-1">
              昵称将显示在你的性格卡片上
            </p>
          </div>

          {/* Variant selector grid */}
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">配色风格</p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              {variants.map((variant, index) => (
                <motion.button
                  key={variant.name}
                  onClick={() => setSelectedVariantIndex(index)}
                  className={`
                    relative aspect-square rounded-lg overflow-hidden
                    ${selectedVariantIndex === index ? 'ring-2 ring-primary scale-105' : 'hover:scale-102'}
                    transition-all duration-200
                  `}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ y: -2 }}
                >
                  <div className={`w-full h-full bg-gradient-to-br ${variant.gradient}`} />
                  {selectedVariantIndex === index && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 bg-white/30 flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 text-white drop-shadow" />
                    </motion.div>
                  )}
                  {/* Variant name tooltip */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-0.5 sm:px-1 py-0.5">
                    <p className="text-[8px] sm:text-[9px] text-white text-center truncate">
                      {variant.name}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
            
            {/* Mood description */}
            {selectedVariant && (
              <motion.p
                key={selectedVariant.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-gray-600 text-center italic"
              >
                {selectedVariant.mood}
              </motion.p>
            )}
          </div>

          {/* Expression selector - simplified minimal design */}
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">表情选择</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {expressionOptions.map((expr) => (
                <motion.button
                  key={expr.id}
                  onClick={() => setSelectedExpression(expr.id)}
                  className={`
                    relative px-4 sm:px-5 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-medium transition-all
                    ${selectedExpression === expr.id 
                      ? 'bg-primary text-white shadow-md scale-[1.02]' 
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-primary/30 shadow-sm'}
                  `}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                    <span className="text-2xl sm:text-3xl">{expr.emoji}</span>
                    <span className="text-xs sm:text-sm">{expr.label}</span>
                  </div>
                  
                  {selectedExpression === expr.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
                    >
                      <span className="text-primary text-sm">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="relative py-6 rounded-2xl font-bold bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg overflow-hidden group border-0"
            >
              {/* Duolingo-style shadow - positioned behind button */}
              <div className="absolute inset-0 rounded-2xl bg-blue-700 translate-y-1 -z-10" />
              
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              
              <span className="relative z-10">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2 inline" />
                    下载图片
                  </>
                )}
              </span>
            </Button>
            
            <Button
              onClick={handleShare}
              disabled={isGenerating}
              className="relative py-6 rounded-2xl font-bold bg-gradient-to-br from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg overflow-hidden group border-0"
            >
              {/* Duolingo-style shadow - positioned behind button */}
              <div className="absolute inset-0 rounded-2xl bg-purple-700 translate-y-1 -z-10" />
              
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              
              <span className="relative z-10">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2 inline" />
                    分享卡片
                  </>
                )}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
