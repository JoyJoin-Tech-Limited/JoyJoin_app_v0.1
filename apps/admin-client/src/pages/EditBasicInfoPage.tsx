import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

const languageOptions = ["普通话", "英语", "粤语", "法语", "日语", "韩语", "西班牙语", "德语"];

const basicInfoSchema = z.object({
  displayName: z.string().min(1, "请输入昵称"),
  gender: z.enum(["Woman", "Man"]).optional(),
  birthdate: z.string().optional(),
  languagesComfort: z.array(z.string()).optional(),
});

type BasicInfoForm = z.infer<typeof basicInfoSchema>;

export default function EditBasicInfoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<BasicInfoForm>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      gender: user?.gender || undefined,
      birthdate: user?.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : "",
      languagesComfort: user?.languagesComfort || [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: BasicInfoForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "保存成功",
        description: "基本信息已更新",
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

  const onSubmit = (data: BasicInfoForm) => {
    // Clean up empty strings - send undefined instead of empty string for optional fields
    const cleanedData = {
      ...data,
      birthdate: data.birthdate && data.birthdate.trim() !== '' ? data.birthdate : undefined,
    };
    updateMutation.mutate(cleanedData);
  };

  const toggleLanguage = (lang: string) => {
    const current = form.watch("languagesComfort") || [];
    if (current.includes(lang)) {
      form.setValue("languagesComfort", current.filter(l => l !== lang));
    } else {
      form.setValue("languagesComfort", [...current, lang]);
    }
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

  const selectedLanguages = form.watch("languagesComfort") || [];

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
          <h1 className="ml-2 text-lg font-semibold">基本信息</h1>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">昵称 *</Label>
          <Input
            id="displayName"
            placeholder="输入你的昵称"
            {...form.register("displayName")}
            data-testid="input-displayName"
          />
          {form.formState.errors.displayName && (
            <p className="text-sm text-destructive">{form.formState.errors.displayName.message}</p>
          )}
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label>性别</Label>
          <div className="space-y-3 mt-2">
            {[
              { value: "Woman", label: "女性" },
              { value: "Man", label: "男性" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue("gender", option.value as "Woman" | "Man")}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all
                  ${form.watch("gender") === option.value
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-gender-${option.value}`}
              >
                <span className="text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Birthdate */}
        <div className="space-y-2">
          <Label htmlFor="birthdate">生日</Label>
          <DatePicker
            value={form.watch("birthdate") && form.watch("birthdate") !== "" ? new Date(form.watch("birthdate")!) : undefined}
            onChange={(date) => {
              if (date) {
                form.setValue("birthdate", date.toISOString().split('T')[0]);
              } else {
                form.setValue("birthdate", "");
              }
            }}
            maxDate={new Date()}
            placeholder="选择出生日期"
            data-testid="input-birthdate"
          />
        </div>

        {/* Languages */}
        <div className="space-y-3">
          <Label>常用语言</Label>
          <div className="flex flex-wrap gap-3">
            {languageOptions.map((lang) => (
              <Badge
                key={lang}
                variant={selectedLanguages.includes(lang) ? "default" : "outline"}
                className="cursor-pointer px-4 py-2 text-base"
                onClick={() => toggleLanguage(lang)}
                data-testid={`badge-language-${lang}`}
              >
                {lang}
              </Badge>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button 
            type="submit" 
            className="w-full"
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </div>
  );
}
