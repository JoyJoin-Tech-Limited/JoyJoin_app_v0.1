import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
}: EventPoolFiltersProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">筛选条件</CardTitle>
        <CardDescription className="text-xs">
          通过城市 + 是否有等待报名 + 是否已有成局来筛活动池。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
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
