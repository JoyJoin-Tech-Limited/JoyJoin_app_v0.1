import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const fullProfileSchema = z.object({
  displayName: z.string().min(1, "请输入昵称"),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  languagesComfort: z.array(z.string()).optional(),
  educationLevel: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  studyLocale: z.string().optional(),
  overseasRegions: z.array(z.string()).optional(),
  industry: z.string().optional(),
  roleTitleShort: z.string().optional(),
  seniority: z.string().optional(),
  relationshipStatus: z.string().optional(),
  children: z.string().optional(),
  interestsTop: z.array(z.string()).optional(),
});

const languageOptions = [
  "普通话",
  "粤语",
  "英语",
  "日语",
  "韩语",
  "法语",
  "德语",
  "西班牙语",
];

const overseasRegionOptions = [
  "北美",
  "欧洲",
  "东亚",
  "东南亚",
  "南亚",
  "中东",
  "大洋洲",
  "拉美",
  "非洲",
];

const industryOptions = [
  "大厂",
  "金融",
  "科技初创",
  "AI/ML",
  "跨境电商",
  "投资",
  "咨询",
  "消费品",
  "艺术/设计",
  "教育",
  "医疗",
  "政府/公共",
  "其他",
];

const interestOptions = [
  "美食探店",
  "咖啡",
  "音乐",
  "电影",
  "阅读",
  "旅行",
  "健身",
  "摄影",
  "艺术",
  "科技",
  "创业",
  "投资",
  "游戏",
  "户外运动",
  "宠物",
];

const budgetOptions = [
  "100以下",
  "100-200",
  "200-300",
  "300-500",
  "500+",
];

interface EditFullProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  onSave: (data: any) => void;
}

export default function EditFullProfileDialog({
  open,
  onOpenChange,
  user,
  onSave,
}: EditFullProfileDialogProps) {
  const form = useForm({
    resolver: zodResolver(fullProfileSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      gender: user?.gender || "",
      birthdate: user?.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : "",
      languagesComfort: user?.languagesComfort || [],
      educationLevel: user?.educationLevel || "",
      fieldOfStudy: user?.fieldOfStudy || "",
      studyLocale: user?.studyLocale || "",
      overseasRegions: user?.overseasRegions || [],
      industry: user?.industry || "",
      roleTitleShort: user?.roleTitleShort || "",
      seniority: user?.seniority || "",
      relationshipStatus: user?.relationshipStatus || "",
      children: user?.children || "",
      interestsTop: user?.interestsTop || [],
    },
  });

  const handleSubmit = (data: any) => {
    // Remove empty string values to prevent validation errors
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => {
        if (typeof value === 'string') return value !== '';
        if (Array.isArray(value)) return value.length > 0;
        return value !== null && value !== undefined;
      })
    );
    onSave(cleanedData);
  };

  const toggleArrayItem = (field: string, value: string) => {
    const current = (form.watch(field as any) as string[]) || [];
    if (current.includes(value)) {
      form.setValue(field as any, current.filter((v: string) => v !== value) as any);
    } else {
      form.setValue(field as any, [...current, value] as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-full-profile">
        <DialogHeader>
          <DialogTitle>编辑个人资料</DialogTitle>
          <DialogDescription className="sr-only">编辑完整个人资料信息</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>
              
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>昵称 *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="输入昵称" data-testid="input-display-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>性别</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-gender">
                          <SelectValue placeholder="选择性别" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Woman">女性</SelectItem>
                        <SelectItem value="Man">男性</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birthdate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>出生日期</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-birthdate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label className="mb-2 block">常用语言</Label>
                <div className="flex flex-wrap gap-2">
                  {languageOptions.map((lang) => (
                    <Badge
                      key={lang}
                      variant={(form.watch("languagesComfort") || []).includes(lang) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleArrayItem("languagesComfort", lang)}
                      data-testid={`badge-language-${lang}`}
                    >
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* 教育背景 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">教育背景</h3>
              
              <FormField
                control={form.control}
                name="educationLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>教育水平</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-education-level">
                          <SelectValue placeholder="选择教育水平" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="High school/below">高中及以下</SelectItem>
                        <SelectItem value="Some college/Associate">大专/副学士</SelectItem>
                        <SelectItem value="Bachelor's">本科</SelectItem>
                        <SelectItem value="Master's">硕士</SelectItem>
                        <SelectItem value="Doctorate">博士</SelectItem>
                        <SelectItem value="Trade/Vocational">职业培训</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fieldOfStudy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>专业领域</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：计算机科学" data-testid="input-field-of-study" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="studyLocale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>学习地点</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-study-locale">
                          <SelectValue placeholder="选择学习地点" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Local">本地</SelectItem>
                        <SelectItem value="Overseas">海外</SelectItem>
                        <SelectItem value="Both">都有</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(form.watch("studyLocale") === "Overseas" || form.watch("studyLocale") === "Both") && (
                <div>
                  <Label className="mb-2 block">海外地区</Label>
                  <div className="flex flex-wrap gap-2">
                    {overseasRegionOptions.map((region) => (
                      <Badge
                        key={region}
                        variant={((form.watch("overseasRegions") as string[] | undefined) || []).includes(region) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleArrayItem("overseasRegions", region)}
                        data-testid={`badge-region-${region}`}
                      >
                        {region}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* 工作信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">工作信息</h3>
              
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>行业</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-industry">
                          <SelectValue placeholder="选择行业" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {industryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleTitleShort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>职位简称</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：产品经理" data-testid="input-role-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seniority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>资历等级</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-seniority">
                          <SelectValue placeholder="选择资历等级" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Intern">实习生</SelectItem>
                        <SelectItem value="Junior">初级</SelectItem>
                        <SelectItem value="Mid">中级</SelectItem>
                        <SelectItem value="Senior">高级</SelectItem>
                        <SelectItem value="Founder">创始人</SelectItem>
                        <SelectItem value="Executive">高管</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* 个人背景 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">个人背景</h3>
              
              <FormField
                control={form.control}
                name="relationshipStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>关系状态</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-relationship-status">
                          <SelectValue placeholder="选择关系状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Single">单身</SelectItem>
                        <SelectItem value="In a relationship">恋爱中</SelectItem>
                        <SelectItem value="Married/Partnered">已婚/已结伴</SelectItem>
                        <SelectItem value="It's complicated">复杂</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="children"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>孩子状况</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-children">
                          <SelectValue placeholder="选择孩子状况" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="No kids">无孩子</SelectItem>
                        <SelectItem value="Expecting">期待中</SelectItem>
                        <SelectItem value="0-5">0-5岁</SelectItem>
                        <SelectItem value="6-12">6-12岁</SelectItem>
                        <SelectItem value="13-18">13-18岁</SelectItem>
                        <SelectItem value="Adult">成年</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                提示：此信息仅自己可见
              </p>
            </div>

            <Separator />

            {/* 兴趣偏好 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">兴趣偏好</h3>
              
              <div>
                <Label className="mb-2 block">兴趣爱好</Label>
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((interest) => (
                    <Badge
                      key={interest}
                      variant={((form.watch("interestsTop") as string[] | undefined) || []).includes(interest) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleArrayItem("interestsTop", interest)}
                      data-testid={`badge-interest-${interest}`}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                取消
              </Button>
              <Button type="submit" data-testid="button-save-profile">
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
