import { useState } from "react";
import { useSearch } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import UserReportsTab from "./moderation/UserReportsTab";
import ChatReportsTab from "./moderation/ChatReportsTab";
import AiContentReportsTab from "./moderation/AiContentReportsTab";

const VALID_TABS = ["users", "chat", "ai"] as const;

// `params` is declared optional so the component stays assignable to wouter's
// RouteComponentProps (routes always inject `params`); it is never read.
export default function AdminModerationPage({
  initialTab,
}: {
  initialTab?: string;
  params?: Record<string, string | undefined>;
}) {
  const search = useSearch();
  const urlTab = new URLSearchParams(search).get("tab");
  const resolvedInitial =
    initialTab ??
    (urlTab && (VALID_TABS as readonly string[]).includes(urlTab) ? urlTab : undefined) ??
    "users";
  const [tab, setTab] = useState(resolvedInitial);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">安全中心</h1>
        <p className="text-muted-foreground mt-1">统一处理用户举报、聊天举报与 AI 内容举报</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
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
          <UserReportsTab />
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
