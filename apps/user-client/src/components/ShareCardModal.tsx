/**
 * ShareCardModal Component
 * Modal for selecting color variants and sharing personality test result cards
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PokemonShareCard } from "./PokemonShareCard";
import { getArchetypeVariants, type ShareCardVariant } from "@/lib/archetypeShareVariants";
import { archetypeAvatars } from "@/lib/archetypeAdapter";
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
  { id: "default", label: "默认", emoji: "😊" },
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
  const [selectedExpression, setSelectedExpression] = useState("default");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Reset selected variant and expression when modal opens
  useEffect(() => {
    if (open) {
      setSelectedVariantIndex(0);
      setSelectedExpression("default");
      setIsPreviewMode(true);
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
  const illustrationUrl = archetypeAvatars[archetype] || "";

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
      
      // Disable preview mode (animation) before capturing
      setIsPreviewMode(false);
      
      // Wait for animation to stop and re-render
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // High-res export
        backgroundColor: null,
        logging: false,
        useCORS: true,
      });

      // Re-enable preview mode
      setIsPreviewMode(true);

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Failed to generate image:', error);
      toast({
        title: "生成失败",
        description: "无法生成分享卡片，请重试",
        variant: "destructive",
      });
      // Re-enable preview mode on error
      setIsPreviewMode(true);
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
    const link = document.createElement('a');
    link.download = filename;
    link.href = imageDataUrl;
    link.click();

    toast({
      title: "下载成功！",
      description: "图片已保存到本地",
    });
  }, [generateImage, archetype, toast]);

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">分享你的性格卡片</h2>
            <p className="text-sm text-gray-600 mt-1">选择你喜欢的配色风格</p>
          </div>

          {/* Variant selector grid */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">配色风格</p>
            <div className="grid grid-cols-5 gap-2 mb-3">
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
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                    <p className="text-[9px] text-white text-center truncate">
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

          {/* Expression selector */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">表情选择</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {expressionOptions.map((expr) => (
                <motion.button
                  key={expr.id}
                  onClick={() => setSelectedExpression(expr.id)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all
                    ${selectedExpression === expr.id 
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50 scale-105' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="mr-1">{expr.emoji}</span>
                  {expr.label}
                  {selectedExpression === expr.id && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-1 inline-block"
                    >
                      ✓
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              表情功能即将上线，敬请期待 🎨
            </p>
          </div>

          {/* Card preview */}
          <div className="flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedVariantIndex}-${selectedExpression}`}
                initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.9, rotateY: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
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
                  isPreview={isPreviewMode}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              variant="outline"
              className="py-6 rounded-2xl font-bold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  下载图片
                </>
              )}
            </Button>
            
            <Button
              onClick={handleShare}
              disabled={isGenerating}
              className="py-6 rounded-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 relative overflow-hidden group"
            >
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  分享卡片
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
