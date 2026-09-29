---
name: Task Planning
description: 多步任务默认先建一份可见的任务清单，并在里程碑处维护状态。当用户要求「拆解 / 计划 / 分步骤」，或当前工作跨 ≥3 步、跨多个阶段、需多次工具调用才能完成时使用。Use when starting multi-step, multi-phase work, when the user asks to plan/break down work, or when a task needs several tool calls to finish — keep the plan visible in the sidebar instead of only in the transcript.
---

# task-planning：多步任务默认落一份可见清单

目标是让计划**可见、可维护、能一眼看出做到哪**，而不是只活在对话里。**默认行为**：遇到多步任务，先建清单再开工，不必等用户提醒。

## 何时建（触发）

满足任一条即建：

- 工作跨 **≥3 步**，或跨多个阶段（分析 → 设计 → 实现 → 验证）。
- 要跨**多次工具调用**才能完成。
- 用户说要「拆解 / 计划 / 分步骤 / 理一下」。
- 长任务需要边做边汇报进度。

单步、一次就能答完的事不建——清单不是仪式。

## 用哪个工具

默认用 `tasks`（本插件提供，渲染在侧边栏）。

如果当前环境里已经有别的计划工具（例如带 objective / acceptanceCriteria 的 `taskflow`，或 `todowrite`）：

- 按那个工具自己的说明使用，不要两套并存——两份清单会互相覆盖，行为不可预期。
- 开工前先看一眼是否**已有**清单；有就沿用并更新它，不要新建。

判断不准时用 `tasks`。

## 怎么建（`tasks`）

一次性传入**完整列表**（覆盖式，不是增量）。字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 短且唯一，如 `T1`、`T1.1` |
| `status` | ✅ | `pending` / `in_progress` / `blocked` / `done` / `cancelled` |
| `summary` | ✅ | 一行描述，动词开头 |
| `parent_id` |  | 填父任务 id 即嵌套为子任务 |

- **颗粒度**：每个任务是**可独立验证**的一步，不是「写代码」这种笼统项。
- **嵌套**：能用父子表达的用 `parent_id`，别拍平成一堆同层项。
- **一次建全**：开工前把已知步骤都列上，别挤牙膏式一次加一条。

## 状态纪律

| 状态 | 含义 |
|---|---|
| `pending` | 未开始 |
| `in_progress` | 正在做（同一时刻尽量只一个） |
| `blocked` | **已确认的真实阻碍**，暂停推进 |
| `done` | 已完成 |
| `cancelled` | 主动移出范围（≠ 做完） |

更新节奏：**只在里程碑处**更新（开始 / 完成 / 遇阻 / 改范围），不要每做一步就刷一遍。收尾时所有项落到 `done` 或 `cancelled`，不留 `pending` / `in_progress`。

## 完成判据

- 清单反映真实进度：没有「已完成但状态还是 pending」的项。
- 完工时无悬挂状态。
- 每个 `cancelled` 都能说清为什么不做。
