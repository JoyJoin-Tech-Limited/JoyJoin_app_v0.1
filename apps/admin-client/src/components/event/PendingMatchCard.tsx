import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, DollarSign, X, Edit, Languages, Utensils, Flame } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { BlindBoxEvent } from "@shared/schema";
import { getCurrencySymbol } from "@/lib/currency";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EditPreferencesDialog from "@/components/EditPreferencesDialog";

interface PendingMatchCardProps {
  event: BlindBoxEvent;
  onCancel: (eventId: string) => void;
}

export default function PendingMatchCard({ event, onCancel }: PendingMatchCardProps) {
  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");
  
  // Progress based on minimum 4 people needed to start
  const currentParticipants = event.currentParticipants || 1;
  const minParticipants = 4;
  const progress = Math.min((currentParticipants / minParticipants) * 100, 100);
  
  const etaText = event.etaMinutes 
    ? `预计${Math.floor(event.etaMinutes / 60)}-${Math.floor(event.etaMinutes / 60) + 1}小时`
    : "预计1-3小时";

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasPreferences = (event.selectedLanguages && event.selectedLanguages.length > 0) ||
    (event.selectedTasteIntensity && event.selectedTasteIntensity.length > 0) ||
    (event.selectedCuisines && event.selectedCuisines.length > 0);

  return (
    <>
      <Card className="border shadow-sm" data-testid={`card-pending-${event.id}`}>
        <CardContent className="p-4 space-y-3">
          {/* 标题 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-base font-semibold" data-testid="text-event-title">{event.title}</h3>
            </div>
            <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              匹配中
            </Badge>
          </div>

          {/* 地区/商圈 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{event.city}•{event.district}</span>
            {event.acceptNearby && (
              <Badge variant="outline" className="text-xs">含相邻商圈</Badge>
            )}
          </div>

          {/* 预算档 */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium" data-testid="text-budget">{currencySymbol}{event.budgetTier}</span>
          </div>

          {/* 目标人数 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>4-6人</span>
          </div>

          {/* 已邀请 */}
          {(event.invitedCount || 0) > 0 && (
            <div className="flex items-center gap-2 text-sm" data-testid="text-invited">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                已邀请{event.invitedCount}人
                {(event.invitedJoined || 0) > 0 ? (
                  <span className="text-primary"> · {event.invitedJoined}人已加入</span>
                ) : (
                  <span className="text-muted-foreground"> · 尚未加入</span>
                )}
              </span>
            </div>
          )}

          {/* 我的偏好 - 可折叠 */}
          {hasPreferences && (
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between p-2 h-auto text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-preferences"
                >
                  <span className="text-sm">我的偏好</span>
                  <span className="text-xs">{detailsOpen ? '收起' : '展开'}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {/* 语言偏好 */}
                {event.selectedLanguages && event.selectedLanguages.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Languages className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-muted-foreground mb-1">语言</div>
                      <div className="flex flex-wrap gap-1">
                        {event.selectedLanguages.map((lang) => (
                          <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 口味偏好 */}
                {event.selectedTasteIntensity && event.selectedTasteIntensity.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Flame className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-muted-foreground mb-1">口味</div>
                      <div className="flex flex-wrap gap-1">
                        {event.selectedTasteIntensity.map((taste) => (
                          <Badge key={taste} variant="outline" className="text-xs">{taste}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 菜系偏好 */}
                {event.selectedCuisines && event.selectedCuisines.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Utensils className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-muted-foreground mb-1">菜系</div>
                      <div className="flex flex-wrap gap-1">
                        {event.selectedCuisines.map((cuisine) => (
                          <Badge key={cuisine} variant="outline" className="text-xs">{cuisine}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* 匹配进度 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">正在为你匹配同频伙伴…</span>
              <span className="text-xs font-medium">{currentParticipants}/{minParticipants}人</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">{etaText}</div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowEditDialog(true)}
              data-testid={`button-edit-${event.id}`}
            >
              <Edit className="h-4 w-4 mr-1" />
              修改偏好
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-destructive hover:text-destructive"
                  data-testid={`button-cancel-${event.id}`}
                >
                  <X className="h-4 w-4 mr-1" />
                  取消报名
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认取消报名？</AlertDialogTitle>
                  <AlertDialogDescription>
                    取消后将退还全额费用。确定要取消吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>再想想</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onCancel(event.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    确认取消
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <EditPreferencesDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        event={event}
      />
    </>
  );
}
