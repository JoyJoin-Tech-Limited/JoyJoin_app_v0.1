import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BlindBoxEvent } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrencySymbol } from "@/lib/currency";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface EditPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: BlindBoxEvent;
}

export default function EditPreferencesDialog({ open, onOpenChange, event }: EditPreferencesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");

  // Parse budget tiers from budgetTier string
  const initialBudget = event.budgetTier.split('/');
  
  const [budgetPreference, setBudgetPreference] = useState<string[]>(initialBudget);
  const [acceptNearby, setAcceptNearby] = useState(event.acceptNearby || false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(event.selectedLanguages || []);
  const [selectedTasteIntensity, setSelectedTasteIntensity] = useState<string[]>(event.selectedTasteIntensity || []);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(event.selectedCuisines || []);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setBudgetPreference(initialBudget);
      setAcceptNearby(event.acceptNearby || false);
      setSelectedLanguages(event.selectedLanguages || []);
      setSelectedTasteIntensity(event.selectedTasteIntensity || []);
      setSelectedCuisines(event.selectedCuisines || []);
    }
  }, [open]);

  const budgetOptions = [
    { value: "100以下", label: "≤100" },
    { value: "100-200", label: "100-200" },
    { value: "200-300", label: "200-300" },
    { value: "300-500", label: "300-500" },
    { value: "500+", label: "500+" },
  ];

  const languageOptions = [
    { value: "中文（国语）", label: "中文（国语）" },
    { value: "中文（粤语）", label: "中文（粤语）" },
    { value: "英语", label: "英语" },
  ];

  const tasteIntensityOptions = [
    { value: "爱吃辣", label: "爱吃辣" },
    { value: "不辣/清淡为主", label: "不辣/清淡为主" },
  ];

  const cuisineOptions = [
    { value: "中餐", label: "中餐" },
    { value: "川菜", label: "川菜" },
    { value: "粤菜", label: "粤菜" },
    { value: "火锅", label: "火锅" },
    { value: "烧烤", label: "烧烤" },
    { value: "西餐", label: "西餐" },
    { value: "日料", label: "日料" },
  ];

  const toggleBudget = (value: string) => {
    setBudgetPreference(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleLanguage = (value: string) => {
    setSelectedLanguages(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleTasteIntensity = (value: string) => {
    setSelectedTasteIntensity(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleCuisine = (value: string) => {
    setSelectedCuisines(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const updateEventMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/blind-box-events/${event.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      toast({
        title: "修改成功",
        description: "偏好已更新",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "修改失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (budgetPreference.length === 0) {
      toast({
        title: "请选择预算范围",
        description: "至少选择一个预算档位",
        variant: "destructive",
      });
      return;
    }

    updateEventMutation.mutate({
      budget: budgetPreference,
      acceptNearby,
      selectedLanguages,
      selectedTasteIntensity,
      selectedCuisines,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-edit-preferences">
        <DialogHeader>
          <DialogTitle>修改偏好设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 预算选择 */}
          <div>
            <Label className="text-base font-semibold mb-3 block">预算范围（可多选）</Label>
            <div className="flex flex-wrap gap-2">
              {budgetOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant={budgetPreference.includes(option.value) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm"
                  onClick={() => toggleBudget(option.value)}
                  data-testid={`badge-budget-${option.value}`}
                >
                  {currencySymbol}{option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* 提升成功率 */}
          <div>
            <Label className="text-base font-semibold mb-3 block">提升成功率</Label>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">相邻商圈</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    例如在福田的话，华侨城和南山也可以
                  </div>
                </div>
                <Switch 
                  checked={acceptNearby} 
                  onCheckedChange={setAcceptNearby}
                  data-testid="switch-accept-nearby"
                />
              </div>
            </div>
          </div>

          {/* 我的偏好 */}
          <Collapsible open={preferencesOpen} onOpenChange={setPreferencesOpen}>
            <div className="space-y-3">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-0 h-auto hover:bg-transparent"
                  data-testid="button-toggle-edit-preferences"
                >
                  <Label className="text-base font-semibold cursor-pointer">我的偏好（可选）</Label>
                  <ChevronDown className={`h-4 w-4 transition-transform ${preferencesOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4">
                {/* 语言偏好 */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">语言</Label>
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((option) => (
                      <Badge
                        key={option.value}
                        variant={selectedLanguages.includes(option.value) ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1.5 text-sm"
                        onClick={() => toggleLanguage(option.value)}
                        data-testid={`badge-language-${option.value}`}
                      >
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 口味偏好 */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">口味</Label>
                  <div className="flex flex-wrap gap-2">
                    {tasteIntensityOptions.map((option) => (
                      <Badge
                        key={option.value}
                        variant={selectedTasteIntensity.includes(option.value) ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1.5 text-sm"
                        onClick={() => toggleTasteIntensity(option.value)}
                        data-testid={`badge-taste-${option.value}`}
                      >
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 菜系偏好 */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">菜系</Label>
                  <div className="flex flex-wrap gap-2">
                    {cuisineOptions.map((option) => (
                      <Badge
                        key={option.value}
                        variant={selectedCuisines.includes(option.value) ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1.5 text-sm"
                        onClick={() => toggleCuisine(option.value)}
                        data-testid={`badge-cuisine-${option.value}`}
                      >
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-edit"
          >
            取消
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateEventMutation.isPending}
            data-testid="button-save-edit"
          >
            {updateEventMutation.isPending ? "保存中..." : "保存修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
