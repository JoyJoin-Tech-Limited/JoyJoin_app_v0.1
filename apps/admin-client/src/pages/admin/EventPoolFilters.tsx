import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  CityFilter,
  WaitingFilter,
  EventsFilter,
  SortOption,
} from "./types";

export type { CityFilter, WaitingFilter, EventsFilter, SortOption };

interface EventPoolFiltersProps {
  cityFilter: CityFilter;
  setCityFilter: (v: CityFilter) => void;
  waitingFilter: WaitingFilter;
  setWaitingFilter: (v: WaitingFilter) => void;
  eventsFilter: EventsFilter;
  setEventsFilter: (v: EventsFilter) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  /**
   * 标题搜索输入值。防抖与 URL 写入由页面负责（`?q=`），这里只负责呈现，
   * 这样输入框不会被替换成 URL 往返后的值，光标不会跳。
   */
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}

export default function EventPoolFilters({
  cityFilter,
  setCityFilter,
  waitingFilter,
  setWaitingFilter,
  eventsFilter,
  setEventsFilter,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
}: EventPoolFiltersProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">筛选条件</CardTitle>
        <CardDescription className="text-xs">
          通过标题搜索 + 城市 + 是否有等待报名 + 是否已有成局来筛活动池。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">标题</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索活动池标题"
              aria-label="按标题搜索活动池"
              className="h-8 w-[220px] pl-8 pr-8 text-xs"
              data-testid="input-search-event-pool"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="清除标题搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="button-clear-event-pool-search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">城市</span>
          <Select
            value={cityFilter}
            onValueChange={(v) => setCityFilter(v as CityFilter)}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="全部城市" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部城市</SelectItem>
              <SelectItem value="深圳">深圳</SelectItem>
              <SelectItem value="香港">香港</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            池子里是否有人在等
          </span>
          <Select
            value={waitingFilter}
            onValueChange={(v) => setWaitingFilter(v as WaitingFilter)}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="hasWaiting">只看有人等待</SelectItem>
              <SelectItem value="noWaiting">只看没人等待</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            池子里是否已有成局
          </span>
          <Select
            value={eventsFilter}
            onValueChange={(v) => setEventsFilter(v as EventsFilter)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="hasEvents">只看有成局</SelectItem>
              <SelectItem value="noEvents">只看还没成局</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">排序</span>
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">创建时间 (最新)</SelectItem>
              <SelectItem value="oldest">创建时间 (最早)</SelectItem>
              <SelectItem value="title">标题 (A-Z)</SelectItem>
              <SelectItem value="mostRegistrations">报名人数 (最多)</SelectItem>
              <SelectItem value="mostMatched">匹配人数 (最多)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
