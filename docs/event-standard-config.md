# 城市活动页标准化配置说明

这份文档用于把当前杭州活动页沉淀成可复用模板。目标是后续换城市、换飞书表、换题库时，尽量只改配置，不改页面代码。

当前状态：这是标准化设计记录，尚未完全实现为配置文件驱动。后续开发应以此为准逐步拆分。

## 目标

- 同一套控制台和投屏页可以复用于不同城市活动。
- 活动方只维护飞书表格、审核状态、题库和活动文案。
- 页面只读取标准化后的公开数据，不直接暴露飞书完整报名信息。
- 报名数据、现场状态、投屏模式、抽题记录彼此分离。

## 标准配置分层

建议未来拆成四层配置。

### 1. 活动基础配置

用于控制页面文案、城市、品牌和投屏页基础信息。

```json
{
  "event": {
    "id": "hangzhou-2026-vibecoding",
    "city": "杭州",
    "title": "兜来乱讲 PPT",
    "subtitle": "杭州 VibeCoding 吐槽专场",
    "bottomLabel": "杭州线下赛",
    "standbyHint": "欢迎入场，稍后一起开始乱讲 PPT。",
    "openingLine": "今晚只讲真实现场，只抽离谱题目。",
    "closingLine": "谢谢每一位乱讲、旁听、起哄和认真 VibeCoding 的人。",
    "refreshIntervalSeconds": 30
  }
}
```

需要避免写死在 HTML 里的信息：

- 活动标题
- 城市
- 副标题
- 底部标签
- 开场文案
- 结束文案
- 刷新频率
- 是否展示观众
- 是否展示关键词墙

### 2. 飞书数据源配置

用于告诉服务端读取哪张飞书表、哪个视图、哪些字段。

```json
{
  "feishu": {
    "appToken": "R4bCbk2xMaetkssM5RRc2lO7nOe",
    "tableId": "tblUq9PLStQwZbVU",
    "viewId": "vewApprovedPublicOnly",
    "fieldAliases": {
      "nickname": ["昵称", "姓名", "你的称呼"],
      "presence": ["你计划如何参与本次活动", "参与方式"],
      "role": ["是否报名作为乱讲PPT的选手参加", "报名身份"],
      "keywords": ["请用三个词来描述你自己", "关键词"],
      "demoDescription": ["最近一个月在VibeCoding啥产品呀？", "作品介绍"],
      "reviewStatus": ["审核状态"],
      "displayOrder": ["展示顺序"]
    }
  }
}
```

后续换城市时，优先换这些值：

- `FEISHU_BITABLE_APP_TOKEN`
- `FEISHU_BITABLE_TABLE_ID`
- `FEISHU_BITABLE_VIEW_ID`
- 字段别名或字段 ID

如果每个城市都复制同一个飞书模板，就只需要换 `appToken/tableId/viewId`。

### 3. 标准报名者结构

前端页面只应该依赖清洗后的标准结构，不依赖飞书原始题目。

```json
{
  "id": "rec...",
  "nickname": "小何",
  "presence": "线上",
  "role": "乱讲PPT选手",
  "reviewStatus": "通过",
  "eligibleForDraw": true,
  "stage": "乱讲PPT选手",
  "keywords": ["拼豆爱好者", "黑客松常客", "codex"],
  "demo": {
    "title": "",
    "description": "最近一个月做的产品说明",
    "url": ""
  },
  "displayOrder": 10
}
```

推荐字段口径：

- `nickname`：公开昵称，必填。
- `presence`：`线上` / `线下` / `还没确定`。
- `role`：`乱讲PPT选手` / `观众/参与者` / `还没定`。
- `reviewStatus`：`待审核` / `通过` / `不展示` / `备选` / `已联系`。
- `eligibleForDraw`：只有明确报名为选手的人才是 `true`。
- `keywords`：只保留公开展示的描述词。
- `demo.description`：只保留可公开展示的作品或产品描述。

统计口径：

- `报名总数`：审核通过且允许展示的人数。
- `选手总数`：审核通过且 `eligibleForDraw = true` 的人数。
- `观众总数`：报名总数 - 选手总数。
- `线上总数`：审核通过且 `presence = 线上` 的人数。

### 4. 题库配置

题库可以继续来自本地 JSON，也可以后续迁到飞书表。

```json
{
  "topics": [
    {
      "id": "t01",
      "title": "给杭州的一次现场协作做一个最小工具",
      "summary": "围绕当天真实活动场景，做一个能立刻帮大家减少混乱的小工具。",
      "pptNo": "PPT-01",
      "pptFile": "PPT-01-hangzhou-collaboration.pptx",
      "enabled": true,
      "weight": 1
    }
  ]
}
```

字段建议：

- `id`
- `title`
- `summary`
- `pptNo`
- `pptFile`
- `enabled`
- `weight`

如果某个城市活动不抽题，可以让题库为空，并让投屏页进入纯展示模式。

## 飞书审核建议

现在开始审核报名后，建议在飞书结果表里新增：

```text
审核状态：待审核 / 通过 / 不展示 / 备选 / 已联系
```

最佳做法是建一个「公开展示视图」：

- 只包含 `审核状态 = 通过` 的记录。
- 只显示活动页需要的公开字段。
- Vercel 环境变量里的 `FEISHU_BITABLE_VIEW_ID` 指向这个视图。

这样页面不需要知道完整审核逻辑，只读取已经审核通过的数据。

## 隐私边界

页面 API 层必须做字段白名单。

允许输出：

- 昵称
- 参与方式
- 报名身份
- 公开描述词
- 公开作品描述
- 可公开链接
- 审核后的展示状态

不要输出：

- 手机号
- 微信号
- 邮箱
- 公司内部备注
- 原始完整问卷内容
- 审核人的私密备注

原则：不要把飞书全量字段传给前端，再由前端决定展示什么。服务端同步层就应该只返回可公开字段。

## 现场状态分离

报名数据来自飞书，是远程同步数据。

现场状态来自控制台，是本地现场操作数据。

两者需要分开保存：

```json
{
  "data": {
    "source": "FEISHU",
    "participants": [],
    "topics": []
  },
  "state": {
    "stageMode": "standby",
    "currentParticipantId": "rec...",
    "draws": {},
    "loadedPptNames": [],
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
}
```

注意事项：

- 刷新飞书报名数据时，不应清空现场抽题记录。
- 如果某个报名者被审核移除，旧抽题记录需要过滤或标记为失效。
- 投屏模式、当前选中人、抽题记录不能依赖飞书排序变化。
- 控制台和投屏页必须读取同一份同步结果。

## 投屏页状态机

当前活动页已经形成这些模式，后续应继续保留：

- `standby`：开场待机
- `focus`：主持人聚焦
- `lobby`：候场
- `caller`：叫号
- `draw`：抽题揭晓
- `talk`：展示中
- `intermission`：中场
- `closing`：结束

后续可配置：

```json
{
  "stageModes": {
    "enabled": ["standby", "focus", "lobby", "caller", "draw", "talk", "intermission", "closing"],
    "default": "standby"
  }
}
```

## 换城市流程清单

1. 复制飞书报名表或多维表模板。
2. 新增或确认 `审核状态` 字段。
3. 建立「公开展示视图」，只筛选审核通过的记录。
4. 确认页面需要字段都在公开视图中。
5. 配置 Vercel 环境变量：
   - `FEISHU_BITABLE_APP_TOKEN`
   - `FEISHU_BITABLE_TABLE_ID`
   - `FEISHU_BITABLE_VIEW_ID`
   - 字段 ID 或字段别名
6. 更新活动基础配置：
   - 城市
   - 标题
   - 副标题
   - 开场/结束文案
7. 更新题库和 PPT 文件名。
8. 打开控制台，确认统计数字。
9. 打开投屏页，确认大屏数据和控制台一致。
10. 现场前清理旧抽题状态或使用新的活动 ID 隔离本地状态。

## 后续实现优先级

### P0

- 支持 `审核状态` 字段。
- API 只返回审核通过且允许展示的数据。
- 控制台和投屏页统一读取实时飞书数据。
- 本地状态按活动 ID 隔离，避免杭州活动缓存影响下一城。

### P1

- 抽出 `event.config.json` 或 `events/<event-id>.json`。
- 活动标题、副标题、开场文案、结束文案改为配置驱动。
- 统计项改为配置或统一 helper。
- 题库支持配置文件切换。

### P2

- 飞书增加题库表和活动配置表。
- 支持一个部署服务多个城市活动。
- 支持 `?event=hangzhou-2026-vibecoding` 切换活动。
- 增加现场前检查页，自动提示缺字段、缺权限、无审核视图等问题。

