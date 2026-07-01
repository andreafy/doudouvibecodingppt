# 杭州活动页接入已有飞书问卷

你不需要重做报名问卷。自动化只需要读现有问卷的“答卷结果表”，把完整报名信息清洗成活动页可展示的脱敏 JSON。

## 数据流

1. 选手提交已有飞书问卷。
2. 问卷结果同步到飞书多维表格或电子表格。
3. 服务端同步器读取结果表，只保留页面展示字段。
4. `hangzhou-event-live.html` 读取脱敏 JSON，并每 60 秒自动刷新。

浏览器页面不要直接调用飞书 API，因为 `app_secret` 不能暴露给观众或选手。

## 页面展示字段

同步器只输出：

- 昵称
- 线上 / 线下
- 身份：乱讲PPT选手或观众/参与者
- Coding 阶段
- 三个描述词 / 关键词
- 可选 Demo 名称、简介、链接

手机号、微信、邮箱等完整报名信息可以留在飞书里，但不会进入活动页 JSON。

## 准备飞书结果表和机器人权限

如果你的问卷已经能看到答卷列表：

1. 打开问卷的收集结果。
2. 把结果同步到多维表格，或找到它已经关联的结果表。
3. 复制结果表 URL 里的 `app_token` 和 `table_id`。
4. 如果你只想展示“审核通过”或“资料完整”的报名者，给结果表建一个视图，然后复制 `view_id`。

字段名不用完全改成页面字段名，可以在环境变量里做映射。

当前可复用的飞书机器人应用：

```text
嘟嘟嘟 / cli_aab0a37e77b81ce7
```

它需要在飞书开放平台申请并发布这个权限：

```text
base:record:read
```

我本机试读记录时，飞书返回它还缺 `base:record:read`。如果要用 `lark-cli` 查看字段列表，还会额外需要 `base:field:read`，但自动同步接口不依赖字段列表读取。

## 如果原问卷结果表不能授权给机器人

走“公开字段镜像表”路线。

原问卷结果表继续保存完整报名信息；另建一张只含活动页展示字段的多维表格，例如：

- 昵称
- 你计划如何参与本次活动？
- 是否报名作为乱讲PPT的选手参加
- 请用三个词来描述你自己
- 最近一个月在VibeCoding啥产品呀？

然后在原问卷结果表里建飞书自动化：

1. 触发器：当记录新增时。
2. 条件：无，或只同步你想展示的视图/状态。
3. 动作：新增记录到“杭州活动公开报名镜像表”。
4. 字段映射：只映射上面 5 个公开字段。

部署接口读取镜像表，而不是原问卷结果表。这样 `嘟嘟嘟` 只需要访问镜像表，不需要碰手机号、微信、邮箱等完整报名信息。

如果用 `lark-cli` 创建镜像表，可以创建成这些字段：

```json
[
  {"name":"昵称","type":"text"},
  {"name":"你计划如何参与本次活动？","type":"text"},
  {"name":"是否报名作为乱讲PPT的选手参加","type":"text"},
  {"name":"请用三个词来描述你自己","type":"text"},
  {"name":"最近一个月在VibeCoding啥产品呀？","type":"text"}
]
```

创建后，把部署环境变量里的 `FEISHU_BITABLE_APP_TOKEN`、`FEISHU_BITABLE_TABLE_ID`、`FEISHU_BITABLE_VIEW_ID` 换成镜像表的值即可。

## 本地生成 JSON

先复制配置样例：

```bash
cp .env.example .env
```

填入：

```bash
FEISHU_APP_ID=cli_aab0a37e77b81ce7
FEISHU_APP_SECRET=xxx
FEISHU_BITABLE_APP_TOKEN=R4bCbk2xMaetkssM5RRc2lO7nOe
FEISHU_BITABLE_TABLE_ID=tblUq9PLStQwZbVU
FEISHU_BITABLE_VIEW_ID=vewNhBX7cO
FEISHU_SYNC_FIELD_IDS=fldwjCjowp|fldJ5N37jD|fld7dfyOMd|fldsBPvsKC|fldFCbRlDT
```

如果问卷题目名字不一样，改这些字段映射：

```bash
FEISHU_FIELD_NICKNAME=昵称
FEISHU_FIELD_PRESENCE=fldJ5N37jD|你计划如何参与本次活动？
FEISHU_FIELD_ROLE=fldsBPvsKC|是否报名作为乱讲PPT的选手参加
FEISHU_FIELD_KEYWORDS=fld7dfyOMd|请用三个词来描述你自己
FEISHU_FIELD_DEMO_DESCRIPTION=fldFCbRlDT|最近一个月在VibeCoding啥产品呀？
```

`FEISHU_FIELD_ROLE` 不会过滤观众；它只用来给报名者打身份标记。乱讲 PPT 选手可以抽题，观众/参与者只展示。

运行同步：

```bash
set -a
source .env
set +a
node scripts/sync-feishu-hangzhou-event.mjs
```

默认会生成：

```text
hangzhou-event-data.json
```

然后用这个 URL 打开页面：

```text
hangzhou-event-live.html?data=hangzhou-event-data.json
```

## 部署后自动读取

如果部署到 Vercel 这类支持 `api/` 函数的平台，把 `.env` 里的变量配置到部署环境。页面可以这样打开：

```text
hangzhou-event-live.html?data=/api/hangzhou-event-data
```

页面会自动每 60 秒刷新一次。新增问卷答卷进入结果表后，会出现在左侧选手列表里。

如果页面和 API 部署在同一个 Vercel 项目，也可以直接打开：

```text
hangzhou-event-live.html
```

页面会默认尝试读取 `/api/hangzhou-event-data`。

## 本地假数据测试

不连飞书也可以先跑一次转换：

```bash
FEISHU_MOCK_RECORDS_PATH=hangzhou-feishu-records.sample.json \
node scripts/sync-feishu-hangzhou-event.mjs
```

确认 `hangzhou-event-data.json` 里没有手机号、微信、邮箱，再接真实飞书表。
