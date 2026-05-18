import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Map, MapPin } from "lucide-react";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import {
  Venue,
  VENUE_TYPES,
  CITIES,
  TAGS,
  CUISINES,
  DECOR_STYLES,
  BAR_THEMES,
  TASTE_INTENSITY_OPTIONS,
  ALCOHOL_OPTIONS,
  RESTAURANT_PRICE_RANGES,
  BAR_PRICE_RANGES,
} from "./venueConstants";
import { shenzhenClusters, getDistrictsByCluster } from "@shared/districts";

export interface VenueFormData {
  name: string;
  type: string;
  address: string;
  city: string;
  district: string;
  clusterId: string;
  districtId: string;
  latitude: string;
  longitude: string;
  contactName: string;
  contactPhone: string;
  commissionRate: string;
  priceRange: string;
  budgetCategories: string[];
  maxConcurrentEvents: string;
  seatingCapacity: string;
  tags: string[];
  cuisines: string[];
  decorStyle: string[];
  tasteIntensity: string[];
  notes: string;
  barThemes: string[];
  alcoholOptions: string[];
  vibeDescriptor: string;
  partnerCompanyName: string;
  businessLicenseNo: string;
  partnerEmail: string;
  bankAccountInfo: string;
  contractStartDate: string;
  contractEndDate: string;
  onboardingStatus: "draft" | "pending_review" | "active" | "suspended";
}

interface VenueFormFieldsProps {
  formData: VenueFormData;
  setFormData: React.Dispatch<React.SetStateAction<VenueFormData>>;
  mode: "create" | "edit";
  setShowMapPicker: (open: boolean) => void;
}

export default function VenueFormFields({ formData, setFormData, mode, setShowMapPicker }: VenueFormFieldsProps) {
  const prefix = mode === "edit" ? "edit-" : "";
  const testIdPrefix = mode === "edit" ? "edit-" : "";

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }));
  };

  const toggleCuisine = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisine) ? prev.cuisines.filter(c => c !== cuisine) : [...prev.cuisines, cuisine],
    }));
  };

  const toggleTasteIntensity = (taste: string) => {
    setFormData(prev => ({
      ...prev,
      tasteIntensity: prev.tasteIntensity.includes(taste)
        ? prev.tasteIntensity.filter(t => t !== taste)
        : [...prev.tasteIntensity, taste],
    }));
  };

  const toggleDecorStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      decorStyle: prev.decorStyle.includes(style)
        ? prev.decorStyle.filter(s => s !== style)
        : [...prev.decorStyle, style],
    }));
  };

  const toggleBarTheme = (theme: string) => {
    setFormData(prev => ({
      ...prev,
      barThemes: prev.barThemes.includes(theme)
        ? prev.barThemes.filter(t => t !== theme)
        : [...prev.barThemes, theme],
    }));
  };

  const toggleAlcoholOption = (option: string) => {
    setFormData(prev => ({
      ...prev,
      alcoholOptions: prev.alcoholOptions.includes(option)
        ? prev.alcoholOptions.filter(o => o !== option)
        : [...prev.alcoholOptions, option],
    }));
  };

  const toggleBudgetCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      budgetCategories: prev.budgetCategories.includes(category)
        ? prev.budgetCategories.filter(c => c !== category)
        : [...prev.budgetCategories, category],
    }));
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}name`}>场地名称 *</Label>
          <Input id={`${prefix}name`} placeholder="例：海底捞火锅" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid={`input-${testIdPrefix}name`} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}type`}>场地类型 *</Label>
          <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
            <SelectTrigger data-testid={`select-${testIdPrefix}type`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {VENUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}address`}>地址 *</Label>
        <div className="flex gap-2">
          <Textarea id={`${prefix}address`} placeholder="详细地址" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} className="flex-1" data-testid={`input-${testIdPrefix}address`} />
          <Button type="button" variant="outline" size="icon" className="h-auto" onClick={() => setShowMapPicker(true)} title="在地图上选择" data-testid="button-open-map">
            <Map className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}city`}>城市 *</Label>
          <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
            <SelectTrigger data-testid={`select-${testIdPrefix}city`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {CITIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}district`}>区域 *</Label>
          <Input id={`${prefix}district`} placeholder="例：南山区" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} data-testid={`input-${testIdPrefix}district`} />
        </div>
      </div>

      {formData.city === "深圳" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}clusterId`} className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />片区</Label>
            <Select value={formData.clusterId} onValueChange={(v) => setFormData({ ...formData, clusterId: v, districtId: "" })}>
              <SelectTrigger data-testid={`select-${testIdPrefix}cluster`}><SelectValue placeholder="选择片区" /></SelectTrigger>
              <SelectContent>
                {shenzhenClusters.map((c: { id: string; name: string }) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}districtId`}>商圈</Label>
            <Select value={formData.districtId} onValueChange={(v) => setFormData({ ...formData, districtId: v })} disabled={!formData.clusterId}>
              <SelectTrigger data-testid={`select-${testIdPrefix}district-id`}><SelectValue placeholder={formData.clusterId ? "选择商圈" : "请先选择片区"} /></SelectTrigger>
              <SelectContent>
                {formData.clusterId && getDistrictsByCluster(formData.clusterId).map((d: { id: string; name: string }) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}contactName`}>联系人</Label>
          <Input id={`${prefix}contactName`} placeholder="联系人姓名" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} data-testid={`input-${testIdPrefix}contact-name`} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}contactPhone`}>联系电话</Label>
          <Input id={`${prefix}contactPhone`} placeholder="联系电话" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} data-testid={`input-${testIdPrefix}contact-phone`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}commissionRate`}>佣金比例 (%)</Label>
          <Input id={`${prefix}commissionRate`} type="number" min="0" max="100" value={formData.commissionRate} onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })} data-testid={`input-${testIdPrefix}commission-rate`} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}priceRange`}>{formData.type === "bar" ? "人均消费(每杯)" : "人均消费"}</Label>
          <Select value={formData.priceRange} onValueChange={(v) => setFormData({ ...formData, priceRange: v })}>
            <SelectTrigger data-testid={`select-${testIdPrefix}price-range`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(formData.type === "bar" ? BAR_PRICE_RANGES : RESTAURANT_PRICE_RANGES).map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}maxConcurrentEvents`}>最大同时活动数</Label>
          <Input id={`${prefix}maxConcurrentEvents`} type="number" min="1" value={formData.maxConcurrentEvents} onChange={(e) => setFormData({ ...formData, maxConcurrentEvents: e.target.value })} data-testid={`input-${testIdPrefix}max-events`} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}seatingCapacity`} className="flex items-center gap-1">
            座位容量
            <FieldInfoTooltip
              title="座位容量"
              description="该场地最多可容纳多少人同时就餐/饮酒。匹配算法用此字段来筛选适合团队人数的场地。"
            />
          </Label>
          <Input id={`${prefix}seatingCapacity`} type="number" min="1" value={formData.seatingCapacity} onChange={(e) => setFormData({ ...formData, seatingCapacity: e.target.value })} data-testid={`input-${testIdPrefix}seating-capacity`} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          预算分类（用于匹配算法）
          <FieldInfoTooltip
            title="预算分类"
            description="选择该场地支持的预算范围，必须与用户注册时的预算选项对齐。自动匹配算法会据此筛选合适的场地。"
          />
        </Label>
        <div className="flex flex-wrap gap-2">
          {(formData.type === "bar" ? BAR_PRICE_RANGES : RESTAURANT_PRICE_RANGES).map(r => (
            <Badge key={r.value} variant={formData.budgetCategories.includes(r.value) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleBudgetCategory(r.value)} data-testid={`budget-${r.value}`}>
              {r.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>氛围标签</Label>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(tag => (
            <Badge key={tag} variant={formData.tags.includes(tag) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTag(tag)} data-testid={`tag-${tag}`}>{tag}</Badge>
          ))}
        </div>
      </div>

      {formData.type === "restaurant" && (
        <>
          <div className="space-y-2">
            <Label>菜系类型</Label>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map(c => (
                <Badge key={c} variant={formData.cuisines.includes(c) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleCuisine(c)} data-testid={`cuisine-${c}`}>{c}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>支持的口味偏好</Label>
            <div className="flex flex-wrap gap-2">
              {TASTE_INTENSITY_OPTIONS.map(t => (
                <Badge key={t} variant={formData.tasteIntensity.includes(t) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTasteIntensity(t)} data-testid={`taste-${t}`}>{t}</Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>装修风格</Label>
        <div className="flex flex-wrap gap-2">
          {DECOR_STYLES.map(s => (
            <Badge key={s} variant={formData.decorStyle.includes(s) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleDecorStyle(s)} data-testid={`decorStyle-${s}`}>{s}</Badge>
          ))}
        </div>
      </div>

      {formData.type === "bar" && (
        <>
          <div className="space-y-2">
            <Label>酒吧主题</Label>
            <div className="flex flex-wrap gap-2">
              {BAR_THEMES.map(t => (
                <Badge key={t} variant={formData.barThemes.includes(t) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleBarTheme(t)} data-testid={`barTheme-${t}`}>{t}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>支持的饮酒选项</Label>
            <div className="flex flex-wrap gap-2">
              {ALCOHOL_OPTIONS.map(o => (
                <Badge key={o} variant={formData.alcoholOptions.includes(o) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleAlcoholOption(o)} data-testid={`alcoholOption-${o}`}>{o}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}vibeDescriptor`}>氛围描述</Label>
            <Input id={`${prefix}vibeDescriptor`} placeholder="例：适合安静聊天、轻松社交氛围" value={formData.vibeDescriptor} onChange={(e) => setFormData({ ...formData, vibeDescriptor: e.target.value })} data-testid={`input-${testIdPrefix}vibeDescriptor`} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${prefix}notes`}>备注</Label>
        <Textarea id={`${prefix}notes`} placeholder="内部备注信息" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} data-testid={`input-${testIdPrefix}notes`} />
      </div>

      <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-sm">🤝 合作伙伴信息 <span className="text-muted-foreground font-normal">(可选)</span></Label>
          <Badge variant="outline" className="text-xs">非必填</Badge>
        </div>
        <p className="text-xs text-muted-foreground">以下信息可在合作深入后补充，当前阶段非必填</p>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}partnerCompanyName`} className="text-xs">合作公司名称</Label>
            <Input id={`${prefix}partnerCompanyName`} placeholder="合作方法人公司名称" value={formData.partnerCompanyName} onChange={(e) => setFormData({ ...formData, partnerCompanyName: e.target.value })} data-testid={`input-${testIdPrefix}partner-company`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}businessLicenseNo`} className="text-xs">营业执照号</Label>
            <Input id={`${prefix}businessLicenseNo`} placeholder="统一社会信用代码" value={formData.businessLicenseNo} onChange={(e) => setFormData({ ...formData, businessLicenseNo: e.target.value })} data-testid={`input-${testIdPrefix}business-license`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}partnerEmail`} className="text-xs">合作联系邮箱</Label>
            <Input id={`${prefix}partnerEmail`} type="email" placeholder="合同/佣金往来邮箱" value={formData.partnerEmail} onChange={(e) => setFormData({ ...formData, partnerEmail: e.target.value })} data-testid={`input-${testIdPrefix}partner-email`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}bankAccountInfo`} className="text-xs">银行账户信息</Label>
            <Input id={`${prefix}bankAccountInfo`} placeholder="用于佣金结算的银行账号" value={formData.bankAccountInfo} onChange={(e) => setFormData({ ...formData, bankAccountInfo: e.target.value })} data-testid={`input-${testIdPrefix}bank-account`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}contractStartDate`} className="text-xs">合同开始日期</Label>
            <Input id={`${prefix}contractStartDate`} type="date" value={formData.contractStartDate} onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })} data-testid={`input-${testIdPrefix}contract-start`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}contractEndDate`} className="text-xs">合同结束日期</Label>
            <Input id={`${prefix}contractEndDate`} type="date" value={formData.contractEndDate} onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })} data-testid={`input-${testIdPrefix}contract-end`} />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <Label className="text-xs flex items-center gap-1">
            合作状态
            <FieldInfoTooltip
              title="场地合作状态"
              description="草稿 = 初步接洽；待审核 = 材料已提交，等待运营审核；正式合作 = 可接受活动预订；已暂停 = 暂时不接受新预订。"
            />
          </Label>
          <Select value={formData.onboardingStatus} onValueChange={(v) => setFormData(prev => ({ ...prev, onboardingStatus: v as NonNullable<Venue['onboardingStatus']> }))}>
            <SelectTrigger className="w-full" data-testid={`select-${testIdPrefix}onboarding-status`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">草稿 (初步接洽)</SelectItem>
              <SelectItem value="pending_review">待审核 (材料提交中)</SelectItem>
              <SelectItem value="active">正式合作</SelectItem>
              <SelectItem value="suspended">已暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
