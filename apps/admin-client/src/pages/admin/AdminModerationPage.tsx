import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { invalidateNavBadges } from "@/lib/navBadges";
import UserReportsTab, { type UserReportsFilter } from "./moderation/UserReportsTab";
import ChatReportsTab from "./moderation/ChatReportsTab";
import AiContentReportsTab from "./moderation/AiContentReportsTab";

const VALID_TABS = ["users", "chat", "ai"] as const;
type ModerationTab = (typeof VALID_TABS)[number];

function parseTabParam(value: string | null | undefined): ModerationTab | null {
  return value && (VALID_TABS as readonly string[]).includes(value) ? (value as ModerationTab) : null;
}

// `params` is declared optional so the component stays assignable to wouter's
// RouteComponentProps (routes always inject `params`); it is never read.
export default function AdminModerationPage({
  initialTab,
}: {
  initialTab?: string;
  params?: Record<string, string | undefined>;
}) {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const urlTab = parseTabParam(new URLSearchParams(search).get("tab"));
  // `?status=pending` is the console action queue's way of saying "the count you
  // clicked is `reports WHERE status='pending'`, so open that slice". The tab
  // owns the filter as local state, so the page has to hand it down; without
  // this the operator lands on 全部 and reads a different population than the
  // number that brought them here.
  const urlReportStatus = new URLSearchParams(search).get("status") === "pending" ? "pending" : "all";
  const [tab, setTab] = useState<ModerationTab>(
    () => parseTabParam(initialTab) ?? urlTab ?? "users",
  );

  // The console action queue deep-links here (`?tab=…`) and `/admin/reports`
  // redirects here with `?tab=chat`. Reading the URL only in the `useState`
  // initialiser made the first deep link work and every later one lose: wouter
  // reuses this component when only the query string changes (no remount), so
  // local state stayed on whatever tab the operator last clicked. The URL is the
  // tie-breaker for the page's whole lifetime, which is only safe because tab
  // clicks write the URL back (see `handleTabChange`).
  useEffect(() => {
    if (urlTab && urlTab !== tab) setTab(urlTab);
  }, [urlTab, tab]);

  const queryClient = useQueryClient();

  // Every tab click rewrites `?tab=`, otherwise the URL keeps describing the
  // previous tab and the next deep link (or a refresh) silently overrides the
  // operator's choice. `replace` keeps tab switching out of the back stack: it
  // is a view option, not a destination.
  //
  // `status` describes a slice of the 用户举报 list only, so it is dropped on the
  // way out instead of riding along on a chat/AI URL no panel reads.
  const handleTabChange = (next: string) => {
    const value = parseTabParam(next) ?? "users";
    setTab(value);
    const nextParams = new URLSearchParams(search);
    nextParams.set("tab", value);
    if (value !== "users") nextParams.delete("status");
    const pathname = location.split("?")[0] || "/admin/moderation";
    navigate(`${pathname}?${nextParams.toString()}`, { replace: true });
  };

  // Same rule for the filter inside the tab: it writes its own param back, or
  // the URL keeps claiming `status=pending` while the list shows 全部.
  const handleReportStatusChange = (status: UserReportsFilter) => {
    const nextParams = new URLSearchParams(search);
    if (status === "pending") nextParams.set("status", "pending");
    else nextParams.delete("status");
    const pathname = location.split("?")[0] || "/admin/moderation";
    navigate(`${pathname}?${nextParams.toString()}`, { replace: true });
  };

  // Report-resolution mutations live inside the tab components
  // (`./moderation/*Tab`), which only invalidate their own lists. While the
  // safety center is open, any successful action here changes the 安全中心 badge,
  // so refresh the sidebar counts instead of waiting for the 30s poll.
  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        invalidateNavBadges(queryClient);
      }
    });
  }, [queryClient]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">安全中心</h1>
        <p className="text-muted-foreground mt-1">统一处理用户举报、聊天举报与 AI 内容举报</p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList data-testid="tabs-safety-inbox">
          <TabsTrigger value="users" data-testid="tab-moderation-users">
            用户举报
          </TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-moderation-chat">
            聊天举报
          </TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-moderation-ai">
            AI 内容
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserReportsTab
            initialReportFilter={urlReportStatus}
            onReportFilterChange={handleReportStatusChange}
          />
        </TabsContent>
        <TabsContent value="chat">
          <ChatReportsTab />
        </TabsContent>
        <TabsContent value="ai">
          <AiContentReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
