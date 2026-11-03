# P1-2 成员信息对等矩阵（现状复核）

日期：2026-11-03。结论：**现有实现已经满足三层渐进披露目标，本次无需产品代码改动。** 本矩阵用于防止未来合并误删，不是要求所有场景显示相同字段。

| 信息/行为 | 概览层 `TablemateCard` | 名单层（`ArchetypeHead` 行组合） | 详情层 `TablemateDetailSheet` | 情境例外/保护 |
|---|---|---|---|---|
| 姓名与「我」身份 | 保留 | 保留 | 保留 | 跨层身份不得漂移 |
| 原型/头像与色彩识别 | 保留 | 保留 | 保留 | 缺图使用 canonical `MissingArchetypePlaceholder`，不得改成空白圈或更低质量 fallback |
| 合拍点/连接信息 | 一个摘要 hook | 只保留适合扫读的次级信息 | 完整内容 | 不要求三层字段数量一致 |
| 成员数量与空位 | 保持真实数量 | 完整名单默认折叠，由用户展开 | 从同一成员进入 | 不为「减法」删除空缺、overflow 或部分揭晓 |
| 点按行为 | 当前概览进入成员详情；已定居卡若明确承担导航可保留 | 互动行进入同一详情 | 同一成员、同一内容 | 不得同样式卡片在无提示下时而开 sheet、时而跳页 |
| 长名/图片失败 | 截断/回退 | 姓名优先，次级信息降级 | 完整详情与安全区 | 未来改动仍需 320px 与真实设备证据 |
| 揭晓与收回 | 不属于普通概览 | 不用名单替代 | 不在此层 | `SquadDeckStage` 与 fan → pocket → reopen 完整保留 |
| 在场/主持/准备状态 | 不承担 | 不泛化 | 不泛化 | `GatheringRoomScene`、`WarmupPresenceStrip` 保持各自语义 |
| 纪念页成员 | 不替换为通用浏览卡 | 保留真实 `avatarUrl`，缺图才回退原型 | 不强制可点 | `gathering-room/memory` 是纪念册，不是成员管理列表 |
| 桌级聚合信息 | 不重复逐人罗列 | 不删除聚合信息 | 不塞入全部模块 | `SquadUnboxingTonightsPanel` 的人员构成、时间地点、主题与开场 hook 保留 |

## 已核实的现状落点

- `pool-group-detail`：`TablemateCard` 概览 + 默认折叠的 `ArchetypeHead` 名单 + 共享 `TablemateDetailSheet`，已经就是目标三层。
- `matching-status`：live reveal 与 settled section 都使用 `TablemateCard`；详情/导航按当前情境保留，不强行统一成同一种跳转。
- `squad-unboxing`：`DeckPillMini` 是 `DeckCollapsePill`  reopen 控件的一部分，不是可独立删除的重复名单。
- `gathering-room/memory`：真实头像优先，原型只作 fallback；当前渲染已经保留温暖的纪念册语言。

## 当前证据

- [揭晓后的扇形](p1-2-current/squad-unboxing-revealed.png)
- [收回后可重开的控件](p1-2-current/squad-unboxing-revealed-pocketed.png)
- [纪念页真实头像与六人构成](p1-2-current/gathering-room-memory.png)

直接访问 matching-status 得到的是 live reveal intro，不是成员列表；其 scanner 结果不得拿来评价成员三层。pool-group-detail 的当前 scanner PASS 只覆盖首屏上部，成员层证据以源码结构为准。未来若改动这些表面，再补完整 BEFORE/AFTER 三视口与真机矩阵。
