import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/ui/use-toast'
import { Loader2, Save, RefreshCw, AlertCircle } from 'lucide-react'
import { apiRequest } from '@/lib/queryClient'
import {
  FEATURE_FLAG_LABELS as flagLabels,
  FEATURE_FLAG_DESCRIPTIONS as flagDescriptions,
  FEATURE_FLAG_SECTIONS,
  FEATURE_FLAG_SECTION_BY_KEY,
} from '@joyjoin/shared'

interface FeatureFlagItem {
  key: string
  value: boolean
  source: 'db' | 'env' | 'fallback'
  updatedAt: string | null
  updatedBy: string | null
}

const DANGEROUS_FLAGS = [
  'onboardingForceSkip',
  'socialIcebreakerClientForceEnd',
  'flashShenzhenLocationGateEnabled',
  'flashTaskRetryTestEnabled',
  'flashAnyLocationArrivalTestEnabled',
]

export default function AdminFeatureFlagsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>({})
  const [pendingToggle, setPendingToggle] = useState<string | null>(null)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery<{ flags: FeatureFlagItem[] }>({
    queryKey: ['/api/admin/feature-flags'],
  })

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      await apiRequest('PUT', `/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        value: String(value),
      })
      return { key, value }
    },
    onSuccess: ({ key }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] })
      setLocalOverrides((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    onError: (_err, _vars) => {
      // Keep the local override so failed keys stay marked 已修改 and can be retried.
    },
    onSettled: (_data, _err, { key }) => {
      setSavingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
  })

  const flags = data?.flags ?? []

  // 搜索同时匹配 key、中文名与描述（运营按「退款」「冰局」等词定位）
  const query = search.trim().toLowerCase()
  const visibleFlags = query
    ? flags.filter((flag) =>
        [flag.key, flagLabels[flag.key] ?? '', flagDescriptions[flag.key] ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : flags

  // 按分区归类（分区定义见 packages/shared/src/copy/featureFlags.ts；
  // 服务端新增但未归类的 key 兜底进「未分类」，提醒补映射）
  const groupedSections = (() => {
    const buckets = new Map<string, FeatureFlagItem[]>()
    for (const flag of visibleFlags) {
      const sectionId = FEATURE_FLAG_SECTION_BY_KEY[flag.key] ?? 'uncategorized'
      const bucket = buckets.get(sectionId) ?? []
      bucket.push(flag)
      buckets.set(sectionId, bucket)
    }
    const ordered = FEATURE_FLAG_SECTIONS.map((section) => ({
      ...section,
      flags: buckets.get(section.id) ?? [],
    })).filter((section) => section.flags.length > 0)
    const uncategorized = buckets.get('uncategorized')
    if (uncategorized && uncategorized.length > 0) {
      ordered.push({
        id: 'uncategorized',
        label: '未分类',
        description: '服务端新增但尚未归类的开关，请补充分区映射',
        flags: uncategorized,
      })
    }
    return ordered
  })()

  const displayValue = (flag: FeatureFlagItem) =>
    localOverrides[flag.key] !== undefined ? localOverrides[flag.key] : flag.value

  const hasChanges = Object.keys(localOverrides).length > 0

  const handleToggle = (key: string) => {
    const flag = flags.find((f) => f.key === key)
    if (!flag) return

    const nextValue = !displayValue(flag)

    // The Flash location restriction is dangerous when disabling; other dangerous flags confirm on enable.
    const needsConfirmation =
      key === 'flashShenzhenLocationGateEnabled'
        ? nextValue === false
        : DANGEROUS_FLAGS.includes(key) && nextValue === true
    if (needsConfirmation) {
      setPendingToggle(key)
      return
    }

    setLocalOverrides((prev) => ({ ...prev, [key]: nextValue }))
  }

  const confirmDangerousToggle = () => {
    if (!pendingToggle) return
    const flag = flags.find((f) => f.key === pendingToggle)
    if (flag) {
      setLocalOverrides((prev) => ({ ...prev, [pendingToggle]: !displayValue(flag) }))
    }
    setPendingToggle(null)
  }

  const handleSave = async () => {
    const entries = Object.entries(localOverrides)
    if (entries.length === 0) return

    setSavingKeys(new Set(entries.map(([k]) => k)))

    // Sequential saves to avoid race conditions on the same row.
    // Collect per-key results so one failure does not abort the remaining saves.
    const failed: string[] = []
    for (const [key, value] of entries) {
      try {
        await updateMutation.mutateAsync({ key, value })
      } catch {
        failed.push(key)
      }
    }

    const succeeded = entries.length - failed.length
    if (failed.length === 0) {
      toast({ title: `${succeeded}/${entries.length} 项保存成功` })
    } else {
      toast({
        title: `${succeeded}/${entries.length} 项保存成功`,
        description: `${failed.length} 项保存失败（${failed.map((k) => flagLabels[k] ?? k).join('、')}），仍标记为已修改，可重试`,
        variant: 'destructive',
      })
    }
  }

  const pendingFlag = pendingToggle ? flags.find((f) => f.key === pendingToggle) : null
  const pendingDisablesLocationGate = pendingToggle === 'flashShenzhenLocationGateEnabled'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">功能开关</h1>
          <p className="text-muted-foreground">运行时功能开关与紧急熔断管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索开关名称或功能…"
            className="w-56"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || updateMutation.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存更改
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : visibleFlags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">{query ? '没有匹配的开关' : '暂无功能开关配置'}</p>
          <p className="text-xs mt-1">
            {query ? '换个关键词试试，支持搜索中文名称或功能描述' : '请检查服务端配置是否正确加载'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedSections.map((section) => (
            <section key={section.id}>
              <div className="mb-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  {section.label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{section.flags.length} 项</span>
                </h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="grid gap-4">
                {section.flags.map((flag) => {
                  const current = displayValue(flag)
                  const changed = localOverrides[flag.key] !== undefined
                  const isSaving = savingKeys.has(flag.key)
                  return (
                    <Card key={flag.key} className={changed ? 'border-primary' : undefined}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <CardTitle className="text-base">
                              {flagLabels[flag.key] ?? flag.key}
                              {changed && <span className="ml-2 text-xs font-normal text-primary">(已修改)</span>}
                            </CardTitle>
                            <CardDescription className="mt-1">{flagDescriptions[flag.key] ?? ''}</CardDescription>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`text-xs font-medium ${current ? 'text-green-600' : 'text-muted-foreground'}`}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin inline" />
                              ) : current ? (
                                '已开启'
                              ) : (
                                '已关闭'
                              )}
                            </span>
                            <Switch
                              id={flag.key}
                              checked={current}
                              onCheckedChange={() => handleToggle(flag.key)}
                              disabled={isSaving}
                              data-testid={`switch-feature-flag-${flag.key}`}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            来源: {flag.source === 'db' ? '数据库' : flag.source === 'env' ? '环境变量' : '默认值'}
                          </span>
                          <span>键名: {flag.key}</span>
                          {flag.updatedAt && <span>更新时间: {new Date(flag.updatedAt).toLocaleString('zh-CN')}</span>}
                          {flag.updatedBy && <span>操作人: {flag.updatedBy}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDisablesLocationGate ? '确认关闭定位限制' : '确认开启危险开关'}</DialogTitle>
            <DialogDescription>
              {pendingFlag
                ? `你即将${pendingDisablesLocationGate ? '关闭' : '开启'}「${flagLabels[pendingFlag.key] ?? pendingFlag.key}」。${flagDescriptions[pendingFlag.key] ?? ''}`
                : `确认要${pendingDisablesLocationGate ? '关闭' : '开启'}此功能开关吗？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingToggle(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDangerousToggle}>
              {pendingDisablesLocationGate ? '确认关闭限制' : '确认开启'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
