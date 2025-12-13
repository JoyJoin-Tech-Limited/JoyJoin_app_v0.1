import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Loader2, Check, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

interface EventPool {
  id: string;
  title: string;
  description: string;
  eventType: string;
  city: string;
  district: string;
  dateTime: string;
  registrationDeadline: string;
  status: string;
  registrationCount: number;
  spotsLeft: number;
  minGroupSize: number;
  maxGroupSize: number;
  targetGroups: number;
}

const budgetOptions = ["100元以下", "100-200", "200-300", "300-500", "500+"];
const languageOptions = ["粤语", "普通话", "英语"];
const socialGoalOptions = ["认识新朋友", "拓展人脉", "轻松聊天", "深度交流", "兴趣探索"];
const cuisineOptions = ["粤菜", "川菜", "日料", "西餐", "火锅", "烧烤", "其他"];
const dietaryOptions = ["无限制", "素食", "清真", "海鲜过敏", "其他过敏"];
const decorStyleOptions = ["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风", "都可以"];

const registrationSchema = z.object({
  budgetRange: z.array(z.string()).min(1, "请至少选择一个预算范围"),
  preferredLanguages: z.array(z.string()).min(1, "请至少选择一种语言"),
  socialGoals: z.array(z.string()).min(1, "请至少选择一个社交目标"),
  cuisinePreferences: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  tasteIntensity: z.enum(["light", "medium", "strong"]),
  decorStylePreferences: z.array(z.string()).optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function EventPoolRegistrationPage() {
  const [, params] = useRoute("/event-pool/:id/register");
  const poolId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [paymentStep, setPaymentStep] = useState<"form" | "payment" | "success">("form");

  // Fetch event pool details
  const { data: pool, isLoading } = useQuery<EventPool>({
    queryKey: ["/api/event-pools", poolId],
    enabled: !!poolId,
  });

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      budgetRange: [],
      preferredLanguages: [],
      socialGoals: [],
      cuisinePreferences: [],
      dietaryRestrictions: [],
      tasteIntensity: "medium",
      decorStylePreferences: [],
    },
  });

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      return await apiRequest("POST", `/api/event-pools/${poolId}/register`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
      setPaymentStep("success");
      setTimeout(() => {
        navigate("/events");
      }, 2000);
    },
    onError: (error: any) => {
      // Check if error is subscription related
      if (error.code === "NO_ACTIVE_SUBSCRIPTION" || error.message?.includes("Subscription required")) {
        toast({
          title: "需要订阅会员",
          description: "活动池报名仅限JoyJoin会员。订阅后可免费参加所有活动池！",
          variant: "destructive",
        });
      } else {
        toast({
          title: "报名失败",
          description: error.message || "无法完成报名，请重试",
          variant: "destructive",
        });
      }
      setPaymentStep("form");
    },
  });

  const onSubmit = (data: RegistrationFormData) => {
    if (!user) {
      toast({
        title: "请先登录",
        description: "需要登录才能报名活动",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    // For now, skip payment step and register directly
    // In production, integrate with WeChat Pay here
    registerMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="活动报名" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="活动报名" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">活动不存在或已被删除</p>
        </div>
      </div>
    );
  }

  if (paymentStep === "success") {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="报名成功" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">报名成功！</h3>
              <p className="text-sm text-muted-foreground">即将跳转到活动页面...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const poolDateTime = parseISO(pool.dateTime);
  const deadline = parseISO(pool.registrationDeadline);

  return (
    <div className="min-h-screen bg-background pb-6">
      <MobileHeader title="活动报名" />

      <div className="px-4 py-6 space-y-6">
        {/* Event Pool Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <CardTitle className="text-xl">{pool.title}</CardTitle>
                <CardDescription className="mt-2">{pool.description}</CardDescription>
              </div>
              <Badge>{pool.eventType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(poolDateTime, 'yyyy年MM月dd日 EEEE HH:mm', { locale: zhCN })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{pool.city} · {pool.district}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>已报名 {pool.registrationCount} 人，剩余 {pool.spotsLeft} 个名额</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>报名截止：{format(deadline, 'MM月dd日 HH:mm', { locale: zhCN })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle>偏好设置</CardTitle>
            <CardDescription>
              填写您的偏好，AI将根据这些信息为您匹配最合适的小组
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Budget Range */}
                <FormField
                  control={form.control}
                  name="budgetRange"
                  render={() => (
                    <FormItem>
                      <FormLabel>预算范围 *</FormLabel>
                      <FormDescription>可多选</FormDescription>
                      <div className="space-y-2">
                        {budgetOptions.map((option) => (
                          <FormField
                            key={option}
                            control={form.control}
                            name="budgetRange"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option])
                                        : field.onChange(field.value?.filter((v) => v !== option));
                                    }}
                                    data-testid={`checkbox-budget-${option}`}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">{option}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Preferred Languages */}
                <FormField
                  control={form.control}
                  name="preferredLanguages"
                  render={() => (
                    <FormItem>
                      <FormLabel>语言偏好 *</FormLabel>
                      <FormDescription>可多选</FormDescription>
                      <div className="space-y-2">
                        {languageOptions.map((option) => (
                          <FormField
                            key={option}
                            control={form.control}
                            name="preferredLanguages"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option])
                                        : field.onChange(field.value?.filter((v) => v !== option));
                                    }}
                                    data-testid={`checkbox-language-${option}`}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">{option}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Social Goals */}
                <FormField
                  control={form.control}
                  name="socialGoals"
                  render={() => (
                    <FormItem>
                      <FormLabel>社交目标 *</FormLabel>
                      <FormDescription>可多选</FormDescription>
                      <div className="space-y-2">
                        {socialGoalOptions.map((option) => (
                          <FormField
                            key={option}
                            control={form.control}
                            name="socialGoals"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option])
                                        : field.onChange(field.value?.filter((v) => v !== option));
                                    }}
                                    data-testid={`checkbox-goal-${option}`}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">{option}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cuisine Preferences */}
                <FormField
                  control={form.control}
                  name="cuisinePreferences"
                  render={() => (
                    <FormItem>
                      <FormLabel>饮食偏好</FormLabel>
                      <FormDescription>可多选（可选）</FormDescription>
                      <div className="space-y-2">
                        {cuisineOptions.map((option) => (
                          <FormField
                            key={option}
                            control={form.control}
                            name="cuisinePreferences"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), option])
                                        : field.onChange(field.value?.filter((v) => v !== option));
                                    }}
                                    data-testid={`checkbox-cuisine-${option}`}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">{option}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dietary Restrictions */}
                <FormField
                  control={form.control}
                  name="dietaryRestrictions"
                  render={() => (
                    <FormItem>
                      <FormLabel>饮食限制</FormLabel>
                      <FormDescription>可多选（可选）</FormDescription>
                      <div className="space-y-2">
                        {dietaryOptions.map((option) => (
                          <FormField
                            key={option}
                            control={form.control}
                            name="dietaryRestrictions"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), option])
                                        : field.onChange(field.value?.filter((v) => v !== option));
                                    }}
                                    data-testid={`checkbox-dietary-${option}`}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">{option}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Taste Intensity */}
                <FormField
                  control={form.control}
                  name="tasteIntensity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>口味偏好</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="space-y-2"
                        >
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="light" data-testid="radio-taste-light" />
                            </FormControl>
                            <Label className="font-normal cursor-pointer">清淡</Label>
                          </FormItem>
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="medium" data-testid="radio-taste-medium" />
                            </FormControl>
                            <Label className="font-normal cursor-pointer">适中</Label>
                          </FormItem>
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="strong" data-testid="radio-taste-strong" />
                            </FormControl>
                            <Label className="font-normal cursor-pointer">重口味</Label>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Decor Style Preferences */}
                <FormField
                  control={form.control}
                  name="decorStylePreferences"
                  render={() => (
                    <FormItem>
                      <FormLabel>🏠 场地风格偏好</FormLabel>
                      <FormDescription>可多选（可选）</FormDescription>
                      <div className="space-y-2">
                        {decorStyleOptions.map((option) => (
                          <FormField
                            key={option}
                            control={form.control}
                            name="decorStylePreferences"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), option])
                                        : field.onChange(field.value?.filter((v) => v !== option));
                                    }}
                                    data-testid={`checkbox-decor-${option}`}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">{option}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-submit-registration"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    "确认报名"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
