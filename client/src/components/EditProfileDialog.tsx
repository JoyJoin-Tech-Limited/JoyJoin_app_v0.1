import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

type SectionType = "basic" | "education" | "work" | "personal" | "interests";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SectionType;
  user: any;
  onSave: (data: any) => void;
}

const basicSchema = z.object({
  displayName: z.string().min(1, "请输入昵称"),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  languagesComfort: z.array(z.string()).optional(),
});

const educationSchema = z.object({
  educationLevel: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  studyLocale: z.string().optional(),
  overseasRegions: z.array(z.string()).optional(),
});

const workSchema = z.object({
  industry: z.string().optional(),
  roleTitleShort: z.string().optional(),
  seniority: z.string().optional(),
});

const personalSchema = z.object({
  relationshipStatus: z.string().optional(),
  children: z.string().optional(),
  hasPets: z.boolean().optional(),
  hasSiblings: z.boolean().optional(),
  currentCity: z.string().optional(),
});

const interestsSchema = z.object({
  interestsTop: z.array(z.string()).optional(),
});

const getSchema = (section: SectionType) => {
  switch (section) {
    case "basic":
      return basicSchema;
    case "education":
      return educationSchema;
    case "work":
      return workSchema;
    case "personal":
      return personalSchema;
    case "interests":
      return interestsSchema;
    default:
      return basicSchema;
  }
};

const getDefaultValues = (section: SectionType, user: any) => {
  switch (section) {
    case "basic":
      return {
        displayName: user?.displayName || "",
        gender: user?.gender || "",
        birthdate: user?.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : "",
        languagesComfort: user?.languagesComfort || [],
      };
    case "education":
      return {
        educationLevel: user?.educationLevel || "",
        fieldOfStudy: user?.fieldOfStudy || "",
        studyLocale: user?.studyLocale || "",
        overseasRegions: user?.overseasRegions || [],
      };
    case "work":
      return {
        industry: user?.industry || "",
        roleTitleShort: user?.roleTitleShort || "",
        seniority: user?.seniority || "",
      };
    case "personal":
      return {
        relationshipStatus: user?.relationshipStatus || "",
        children: user?.children || "",
        hasPets: user?.hasPets,
        hasSiblings: user?.hasSiblings,
        currentCity: user?.currentCity || "",
      };
    case "interests":
      return {
        interestsTop: user?.interestsTop || [],
      };
    default:
      return {};
  }
};

const sectionTitles: Record<SectionType, string> = {
  basic: "编辑基本信息",
  education: "编辑教育背景",
  work: "编辑工作信息",
  personal: "编辑个人背景",
  interests: "编辑兴趣偏好",
};

const languageOptions = [
  "普通话",
  "粤语",
  "英语",
  "四川话",
  "东北话",
  "河南话",
  "山东话",
  "湖北话",
  "湖南话",
  "闽南话",
  "上海话",
  "客家话",
  "潮汕话",
  "温州话",
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
  "学生",
  "大厂",
  "金融-银行",
  "金融-证券",
  "金融-保险",
  "金融-投行",
  "金融-PE/VC",
  "金融-其他",
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

export default function EditProfileDialog({
  open,
  onOpenChange,
  section,
  user,
  onSave,
}: EditProfileDialogProps) {
  const form = useForm({
    resolver: zodResolver(getSchema(section)),
    defaultValues: getDefaultValues(section, user),
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid={`dialog-edit-${section}`}>
        <DialogHeader>
          <DialogTitle>{sectionTitles[section]}</DialogTitle>
          <DialogDescription className="sr-only">编辑个人资料信息</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            {section === "basic" && (
              <>
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
              </>
            )}

            {section === "education" && (
              <>
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
              </>
            )}

            {section === "work" && (
              <>
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
              </>
            )}

            {section === "personal" && (
              <>
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
                          <SelectItem value="Divorced">离异</SelectItem>
                          <SelectItem value="Widowed">丧偶</SelectItem>
                          <SelectItem value="Prefer not to say">不方便透露</SelectItem>
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

                <div>
                  <Label className="mb-2 block">有毛孩子吗</Label>
                  <div className="flex gap-2">
                    <Badge
                      variant={form.watch("hasPets") === true ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => form.setValue("hasPets" as any, true)}
                      data-testid="badge-pets-yes"
                    >
                      有
                    </Badge>
                    <Badge
                      variant={form.watch("hasPets") === false ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => form.setValue("hasPets" as any, false)}
                      data-testid="badge-pets-no"
                    >
                      没有
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">有亲兄弟姐妹吗</Label>
                  <div className="flex gap-2">
                    <Badge
                      variant={form.watch("hasSiblings") === true ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => form.setValue("hasSiblings" as any, true)}
                      data-testid="badge-siblings-yes"
                    >
                      有
                    </Badge>
                    <Badge
                      variant={form.watch("hasSiblings") === false ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => form.setValue("hasSiblings" as any, false)}
                      data-testid="badge-siblings-no"
                    >
                      独生子女
                    </Badge>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="currentCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>现居城市</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-current-city">
                            <SelectValue placeholder="选择现居城市" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="香港">香港</SelectItem>
                          <SelectItem value="深圳">深圳</SelectItem>
                          <SelectItem value="广州">广州</SelectItem>
                          <SelectItem value="东莞">东莞</SelectItem>
                          <SelectItem value="珠海">珠海</SelectItem>
                          <SelectItem value="澳门">澳门</SelectItem>
                          <SelectItem value="其他">其他</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="text-xs text-muted-foreground">
                  提示：此信息仅自己可见
                </p>
              </>
            )}

            {section === "interests" && (
              <>
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
              </>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                取消
              </Button>
              <Button type="submit" data-testid="button-save">
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
