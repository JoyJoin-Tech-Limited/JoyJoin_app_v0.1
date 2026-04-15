import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  getPaymentVerificationErrorDecision,
  getPaymentVerificationStatusDecision,
  type PaymentVerificationState,
} from "@shared/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

type BrowserPendingOrderContext = {
  type?: "event" | "event_bundle";
};

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;
const BROWSER_PENDING_ORDER_KEY = "joyjoin.browser.pending_order";
const BROWSER_PENDING_ORDER_CONTEXT_KEY = "joyjoin.browser.pending_order_context";

async function requestJson<T>(url: string): Promise<T> {
  const response = await apiRequest("GET", url);
  return response.json() as Promise<T>;
}

function clearPendingOrderStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BROWSER_PENDING_ORDER_KEY);
  window.localStorage.removeItem(BROWSER_PENDING_ORDER_CONTEXT_KEY);
}

function readPendingOrderContext(): BrowserPendingOrderContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_PENDING_ORDER_CONTEXT_KEY);
    return raw ? JSON.parse(raw) as BrowserPendingOrderContext : null;
  } catch {
    return null;
  }
}

function readPendingOrderId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(BROWSER_PENDING_ORDER_KEY) ?? "";
}

function readIncomingOrderId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("outTradeNo") ?? "";
}

function getBrowserPaymentStatusMessage(
  status: PaymentVerificationState,
  context: BrowserPendingOrderContext | null,
): string {
  switch (status) {
    case "paid":
      return context?.type === "event"
        ? "支付已确认，正在把你加入活动匹配队列..."
        : "支付已确认，正在为你发放会员权益...";
    case "failed":
      return "支付未完成，请返回支付页重新发起支付。";
    case "pending":
      return "暂时无法确认支付结果，你可以稍后回来继续确认订单状态。";
    case "polling":
    default:
      return "正在确认支付结果...";
  }
}

function getBrowserPaymentErrorMessage(status: PaymentVerificationState): string {
  switch (status) {
    case "pending":
      return "暂时无法确认支付结果，你可以稍后回来继续确认订单状态。";
    case "polling":
      return "支付状态同步稍慢，正在重新确认...";
    default:
      return getBrowserPaymentStatusMessage(status, null);
  }
}

export default function BlindBoxConfirmationPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [context, setContext] = useState<BrowserPendingOrderContext | null>(null);
  const [status, setStatus] = useState<PaymentVerificationState>("polling");
  const [message, setMessage] = useState("正在确认支付结果...");
  const [attemptCount, setAttemptCount] = useState(0);
  const isPollingRef = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const destinationPath = context?.type === "event" ? "/events" : "/discover";
  const destinationLabel = context?.type === "event" ? "活动页" : "探索页";

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const navigateAfterPaid = useCallback((nextContext: BrowserPendingOrderContext | null) => {
    clearPendingOrderStorage();
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });

    if (nextContext?.type === "event") {
      window.localStorage.removeItem("blindbox_event_data");
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/joined"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
      setLocation("/events");
      return;
    }

    setLocation("/discover");
  }, [queryClient, setLocation]);

  const pollPaymentStatus = useCallback(async (
    targetOrderId: string,
    nextContext: BrowserPendingOrderContext | null,
    attempt = 1,
  ) => {
    if (!targetOrderId || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;
    setAttemptCount(attempt);

    const scheduleRetry = () => {
      timeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        isPollingRef.current = false;
        void pollPaymentStatus(targetOrderId, nextContext, attempt + 1);
      }, POLL_INTERVAL_MS);
    };

    try {
      const response = await requestJson<{ status?: string }>(
        `/api/payments/status/${encodeURIComponent(targetOrderId)}`,
      );

      const decision = getPaymentVerificationStatusDecision({
        remoteStatus: response.status,
        attempt,
        maxAttempts: MAX_POLL_ATTEMPTS,
      });

      if (decision.clearPendingOrder) {
        clearPendingOrderStorage();
      }

      setStatus(decision.status);
      setMessage(getBrowserPaymentStatusMessage(decision.status, nextContext));

      if (decision.status === "paid") {
        timeoutRef.current = setTimeout(() => {
          navigateAfterPaid(nextContext);
        }, 1200);
        return;
      }

      if (!decision.shouldRetry) {
        return;
      }

      scheduleRetry();
      return;
    } catch {
      const decision = getPaymentVerificationErrorDecision({
        attempt,
        maxAttempts: MAX_POLL_ATTEMPTS,
      });

      setStatus(decision.status);
      setMessage(getBrowserPaymentErrorMessage(decision.status));

      if (!decision.shouldRetry) {
        return;
      }

      scheduleRetry();
      return;
    } finally {
      isPollingRef.current = false;
    }
  }, [navigateAfterPaid]);

  const bootstrap = useCallback((incomingOrderId?: string) => {
    clearTimer();

    const nextContext = readPendingOrderContext();
    const targetOrderId = (incomingOrderId || readIncomingOrderId() || readPendingOrderId()).trim();
    setContext(nextContext);

    if (!targetOrderId) {
      clearPendingOrderStorage();
      setStatus("failed");
      setMessage("未找到待确认订单，请返回支付页重新发起支付。");
      return;
    }

    setOrderId(targetOrderId);
    setStatus("polling");
    setMessage("正在确认支付结果...");
    void pollPaymentStatus(targetOrderId, nextContext, 1);
  }, [clearTimer, pollPaymentStatus]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(180deg,_rgba(240,253,250,1)_0%,_rgba(239,246,255,1)_45%,_rgba(250,245,255,1)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.2),_transparent_35%),linear-gradient(180deg,_rgba(6,10,18,1)_0%,_rgba(10,16,28,1)_45%,_rgba(18,12,30,1)_100%)]">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-6"
        >
          <Card className="overflow-hidden border-0 shadow-2xl">
            <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-6 py-6 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/80">JoyJoin Payment</p>
                  <h1 className="mt-1 text-2xl font-bold">订单确认中</h1>
                </div>
                <Badge className="border-0 bg-white/15 text-white">
                  {context?.type === "event" ? "活动票" : "会员权益"}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-white/85">{message}</p>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="flex items-center gap-4 rounded-2xl border bg-background/80 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                  {status === "paid" ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : status === "failed" ? (
                    <AlertCircle className="h-6 w-6" />
                  ) : status === "pending" ? (
                    <RefreshCw className="h-6 w-6" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">订单号</p>
                  <p className="truncate text-sm text-muted-foreground" data-testid="text-order-id">
                    {orderId || "待获取"}
                  </p>
                </div>

                <Badge variant="outline">
                  {status === "polling" && "查询中"}
                  {status === "paid" && "已支付"}
                  {status === "pending" && "处理中"}
                  {status === "failed" && "未完成"}
                </Badge>
              </div>

              {status === "polling" ? (
                <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  已查询 {attemptCount} / {MAX_POLL_ATTEMPTS} 次。支付完成后页面会自动跳转到你的{destinationLabel}。
                </div>
              ) : null}

              {status === "paid" ? (
                <div className="space-y-3">
                  <Button className="w-full" onClick={() => navigateAfterPaid(context)} data-testid="button-confirmation-continue">
                    进入{destinationLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              {status === "pending" ? (
                <div className="space-y-3">
                  <Button className="w-full" onClick={() => bootstrap(orderId)} data-testid="button-confirmation-retry">
                    继续查询订单状态
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setLocation(destinationPath)}>
                    先去{destinationLabel}
                  </Button>
                </div>
              ) : null}

              {status === "failed" ? (
                <div className="space-y-3">
                  <Button className="w-full" onClick={() => setLocation("/blindbox/payment")} data-testid="button-confirmation-repay">
                    返回支付页
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setLocation(destinationPath)}>
                    返回{destinationLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
