import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RELATIONSHIP_STATUS_OPTIONS, CHILDREN_OPTIONS } from "@shared/constants";

type PersonalData = {
  relationshipStatus?: string;
  children?: string;
  hasPets?: boolean;
  hasSiblings?: boolean;
  currentCity?: string;
};

const relationshipOptions = [
  { value: "单身", label: "单身" },
  { value: "恋爱中", label: "恋爱中" },
  { value: "已婚/伴侣", label: "已婚/伴侣" },
  { value: "离异", label: "离异" },
  { value: "丧偶", label: "丧偶" },
  { value: "不透露", label: "不透露" },
];

const childrenOptions = [
  { value: "无孩子", label: "无孩子" },
  { value: "期待中", label: "期待中" },
  { value: "0-5岁", label: "0-5岁" },
  { value: "6-12岁", label: "6-12岁" },
  { value: "13-18岁", label: "13-18岁" },
  { value: "成年", label: "成年" },
  { value: "不透露", label: "不透露" },
];

const currentCityOptions = ["香港", "深圳", "广州", "东莞", "珠海", "澳门", "其他"];

export default function EditPersonalPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  
  const [relationshipStatus, setRelationshipStatus] = useState<string | undefined>(user?.relationshipStatus);
  const [children, setChildren] = useState<string | undefined>(user?.children);
  const [hasPets, setHasPets] = useState<boolean | undefined>(user?.hasPets);
  const [hasSiblings, setHasSiblings] = useState<boolean | undefined>(user?.hasSiblings);
  const [currentCity, setCurrentCity] = useState<string | undefined>(user?.currentCity);

  const updateMutation = useMutation({
    mutationFn: async (data: PersonalData) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "保存成功",
        description: "个人背景已更新",
      });
      setLocation("/profile/edit");
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      relationshipStatus,
      children,
      hasPets,
      hasSiblings,
      currentCity,
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 text-lg font-semibold">个人背景</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-8 max-w-2xl mx-auto pb-24">
        {/* Relationship Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">关系状态</h2>
          <div className="space-y-3">
            {relationshipOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setRelationshipStatus(option.value)}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all
                  ${relationshipStatus === option.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-relationship-${option.value}`}
              >
                <span className="text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Children Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">孩子状况</h2>
          <div className="space-y-3">
            {childrenOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setChildren(option.value)}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all
                  ${children === option.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-children-${option.value}`}
              >
                <span className="text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Has Pets */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">有毛孩子吗</h2>
            <p className="text-sm text-muted-foreground">帮你找到同为铲屎官的朋友</p>
          </div>
          <div className="flex gap-3">
            {[
              { value: true, label: "有" },
              { value: false, label: "没有" },
            ].map((option) => (
              <button
                key={String(option.value)}
                onClick={() => setHasPets(option.value)}
                className={`
                  flex-1 py-4 px-4 rounded-lg border text-center transition-all
                  ${hasPets === option.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-pets-${option.value}`}
              >
                <span className="text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Has Siblings */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">有亲兄弟姐妹吗</h2>
            <p className="text-sm text-muted-foreground">独生子女的默契懂的都懂</p>
          </div>
          <div className="flex gap-3">
            {[
              { value: true, label: "有" },
              { value: false, label: "独生子女" },
            ].map((option) => (
              <button
                key={String(option.value)}
                onClick={() => setHasSiblings(option.value)}
                className={`
                  flex-1 py-4 px-4 rounded-lg border text-center transition-all
                  ${hasSiblings === option.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-siblings-${option.value}`}
              >
                <span className="text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current City */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">现居城市</h2>
            <p className="text-sm text-muted-foreground">帮你找到同城小伙伴</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentCityOptions.map((city) => (
              <button
                key={city}
                onClick={() => setCurrentCity(city)}
                className={`
                  px-4 py-3 rounded-lg border text-sm transition-all
                  ${currentCity === city
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-current-city-${city}`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="text-center text-sm text-muted-foreground">
          提示：此信息仅自己可见
        </div>

        {/* Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button 
            onClick={handleSave}
            className="w-full"
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
