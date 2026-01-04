import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Share2, MapPin, Clock, Users, Sparkles, Crown, X } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { BlindBoxEvent } from "@shared/schema";
import { archetypeAvatars } from "@/lib/archetypeAvatars";
import { formatDateInHongKong } from "@/lib/hongKongTime";

interface InvitePreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: BlindBoxEvent;
}

interface MatchedAttendee {
  userId: string;
  displayName: string;
  archetype?: string;
  topInterests?: string[];
  age?: number;
  industry?: string;
}

export default function InvitePreviewSheet({ open, onOpenChange, event }: InvitePreviewSheetProps) {
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const inviteRef = useRef<HTMLDivElement>(null);

  const attendees = (event.matchedAttendees as MatchedAttendee[]) || [];

  const handleShare = async () => {
    const shareData = {
      title: `JoyJoin活动邀请 - ${event.title}`,
      text: `邀请你参加${event.restaurantName || '神秘餐厅'}的聚会！`,
      url: window.location.origin + `/events/${event.id}/invite`,
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      toast({ title: '邀请链接已复制！' });
    }
  };

  const handleReveal = () => {
    setIsRevealed(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] rounded-t-3xl p-0 overflow-hidden"
        data-testid="invite-preview-sheet"
      >
        <AnimatePresence mode="wait">
          {!isRevealed ? (
            <motion.div
              key="envelope"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30"
            >
              <motion.div
                className="relative cursor-pointer"
                onClick={handleReveal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="w-72 h-48 bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 rounded-2xl shadow-2xl flex items-center justify-center"
                  animate={{ 
                    boxShadow: [
                      '0 25px 50px -12px rgba(251, 191, 36, 0.4)',
                      '0 25px 50px -12px rgba(251, 191, 36, 0.6)',
                      '0 25px 50px -12px rgba(251, 191, 36, 0.4)',
                    ]
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <div className="text-center text-white">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <Crown className="w-12 h-12 mx-auto mb-3" />
                    </motion.div>
                    <p className="text-lg font-bold">JoyJoin VIP</p>
                    <p className="text-sm opacity-90">点击开启邀请函</p>
                  </div>
                </motion.div>
                
                <motion.div
                  className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  NEW
                </motion.div>
              </motion.div>
              
              <p className="mt-6 text-muted-foreground text-sm">轻触卡片揭晓你的专属邀请</p>
            </motion.div>
          ) : (
            <motion.div
              key="invite"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="h-full flex flex-col"
              ref={inviteRef}
            >
              <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  电子邀请函
                </SheetTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-close-invite"
                >
                  <X className="w-5 h-5" />
                </Button>
              </SheetHeader>

              <div className="flex-1 overflow-auto">
                <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 p-4 m-4 rounded-2xl border-2 border-amber-200 dark:border-amber-800 shadow-lg">
                  <div className="text-center mb-6">
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white mb-2">
                      VIP INVITATION
                    </Badge>
                    <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                      {event.title}
                    </h2>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">地点</p>
                        <p className="font-medium">{event.restaurantName || '神秘餐厅'}</p>
                        <p className="text-xs text-muted-foreground">{event.restaurantAddress}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">时间</p>
                        <p className="font-medium">{formatDateInHongKong(event.dateTime, 'full')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
                        <Users className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">人数</p>
                        <p className="font-medium">{event.totalParticipants}人小聚</p>
                      </div>
                    </div>
                  </div>

                  {attendees.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs text-muted-foreground mb-3 text-center">本桌成员</p>
                      <div className="flex justify-center -space-x-2">
                        {attendees.slice(0, 6).map((attendee, idx) => (
                          <motion.div
                            key={attendee.userId}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <Avatar className="w-10 h-10 border-2 border-white dark:border-gray-800">
                              {attendee.archetype && archetypeAvatars[attendee.archetype] ? (
                                <AvatarImage src={archetypeAvatars[attendee.archetype]} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white text-xs">
                                {attendee.displayName?.slice(0, 1) || '?'}
                              </AvatarFallback>
                            </Avatar>
                          </motion.div>
                        ))}
                        {attendees.length > 6 && (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-white dark:border-gray-800">
                            +{attendees.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <motion.button
                      className="p-4 bg-white dark:bg-gray-900 rounded-xl shadow-md"
                      onClick={() => setShowQR(!showQR)}
                      whileTap={{ scale: 0.95 }}
                      data-testid="button-toggle-qr"
                    >
                      {showQR ? (
                        <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg flex items-center justify-center">
                          <div className="grid grid-cols-5 gap-1">
                            {Array(25).fill(0).map((_, i) => (
                              <div 
                                key={i} 
                                className={`w-5 h-5 rounded-sm ${Math.random() > 0.5 ? 'bg-gray-900 dark:bg-white' : 'bg-transparent'}`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="w-32 h-32 flex flex-col items-center justify-center text-muted-foreground">
                          <QrCode className="w-12 h-12 mb-2" />
                          <span className="text-xs">点击显示二维码</span>
                        </div>
                      )}
                    </motion.button>
                  </div>

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    向场馆工作人员出示此邀请函
                  </p>
                </div>
              </div>

              <div className="p-4 border-t bg-background/80 backdrop-blur-sm flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowQR(true)}
                  data-testid="button-quick-show"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  快速亮出
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={handleShare}
                  data-testid="button-share-invite"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  分享邀请函
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
