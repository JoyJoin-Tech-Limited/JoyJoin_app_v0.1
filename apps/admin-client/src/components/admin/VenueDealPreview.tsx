import {
  VENUE_DEAL_CODE_HINT,
  VENUE_DEAL_CODE_PLACEHOLDER,
  VENUE_DEAL_CREDENTIAL_TITLE,
  VENUE_DEAL_DEFAULT_DISCOUNT_DESCRIPTION,
  VENUE_DEAL_DEFAULT_DISCOUNT_TITLE,
  VENUE_DEAL_DEFAULT_SET_MENU_DESCRIPTION,
  VENUE_DEAL_DEFAULT_SET_MENU_TITLE,
  VENUE_DEAL_DISCOUNT_VALUE_ERROR,
  VENUE_DEAL_PREVIEW_VENUE_PLACEHOLDER,
  VENUE_DEAL_RULE_LINE,
  VENUE_DEAL_SET_MENU_PRICE_NOTE,
  VENUE_DEAL_SHOW_PAGE_HINT,
  VENUE_DEAL_SHOW_PAGE_SUBTITLE,
  formatCentsAsYuan,
  formatDiscountLabel,
  getVenueDealValueText,
} from "@shared/copy/venueDealCopy";

export interface VenueDealPreviewProps {
  kind: "discount" | "set_menu";
  title: string;
  description?: string;
  /** 统一折扣：discountValue 整数 1–90（20 = 8 折） */
  discountValue?: number | null;
  setMenuPriceCents?: number | null;
  setMenuOriginalPriceCents?: number | null;
  method: "show_page" | "code";
  code?: string;
  venueName?: string;
}

/**
 * 后台实时预览。卡面文案全部来自 `@shared/copy/venueDealCopy`，
 * 与小程序 `VenueDealCard` / 同桌凭证共用同一套措辞，不允许在 admin 另写一份。
 * 这里只做排版近似，真实视觉以 `docs/design/venue-deal/` 的已批准设计稿为准。
 */
export default function VenueDealPreview({
  kind,
  title,
  description,
  discountValue,
  setMenuPriceCents,
  setMenuOriginalPriceCents,
  method,
  code,
  venueName,
}: VenueDealPreviewProps) {
  const valueText = getVenueDealValueText({
    kind,
    valueOffPercent: discountValue ?? undefined,
    setMenuPriceCents: setMenuPriceCents ?? undefined,
  });
  const originalPrice =
    kind === "set_menu" && setMenuOriginalPriceCents
      ? formatCentsAsYuan(setMenuOriginalPriceCents)
      : "";
  const displayTitle =
    title.trim() ||
    (kind === "discount" ? VENUE_DEAL_DEFAULT_DISCOUNT_TITLE : VENUE_DEAL_DEFAULT_SET_MENU_TITLE);

  return (
    <div className="space-y-3" data-testid="venue-deal-preview">
      <div
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "#FFF1EA", borderColor: "#F3C9B6" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="min-w-[72px] text-3xl font-bold leading-tight"
            style={{ color: "#B4462B" }}
            data-testid="preview-value"
          >
            {valueText || "—"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-[#2D3142]" data-testid="preview-title">
              {displayTitle}
            </div>
            {originalPrice && (
              <div className="text-sm text-[#6B6357]">
                <span className="line-through" data-testid="preview-original-price">
                  ¥{originalPrice}
                </span>
                <span className="ml-2">{VENUE_DEAL_SET_MENU_PRICE_NOTE}</span>
              </div>
            )}
            <div className="mt-1 text-sm text-[#6B6357]" data-testid="preview-description">
              {description?.trim() ||
                (kind === "discount"
                  ? VENUE_DEAL_DEFAULT_DISCOUNT_DESCRIPTION
                  : VENUE_DEAL_DEFAULT_SET_MENU_DESCRIPTION)}
            </div>
            <div className="mt-2 text-xs text-[#6B6357]">{venueName || VENUE_DEAL_PREVIEW_VENUE_PLACEHOLDER}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-dashed pt-2 text-xs text-[#6B6357]" style={{ borderColor: "#F3C9B6" }}>
          {VENUE_DEAL_RULE_LINE}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 text-center">
        <div className="text-xs text-muted-foreground">{VENUE_DEAL_CREDENTIAL_TITLE} · 出示页</div>
        {method === "code" ? (
          <div className="mt-2 text-2xl font-bold tracking-widest text-[#2D3142]" data-testid="preview-code">
            {code?.trim() || VENUE_DEAL_CODE_PLACEHOLDER}
          </div>
        ) : (
          <div className="mt-2 text-sm text-[#2D3142]" data-testid="preview-show-page">
            {VENUE_DEAL_SHOW_PAGE_HINT}
          </div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {method === "code" ? VENUE_DEAL_CODE_HINT : VENUE_DEAL_SHOW_PAGE_SUBTITLE}
        </div>
      </div>

      {kind === "discount" && discountValue != null && !formatDiscountLabel(discountValue) && (
        <p className="text-xs text-destructive">{VENUE_DEAL_DISCOUNT_VALUE_ERROR}</p>
      )}
    </div>
  );
}
