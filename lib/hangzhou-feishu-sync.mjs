import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_FIELD_ALIASES = {
  nickname: ["fldwjCjowp", "昵称", "姓名", "你的称呼", "称呼", "Name"],
  presence: ["fldJ5N37jD", "你计划如何参与本次活动？", "你计划如何参与本次活动", "线上/线下", "线上线下", "参与方式", "到场方式", "参赛方式"],
  role: ["fldsBPvsKC", "是否报名作为乱讲PPT的选手参加", "是否报名作为乱讲 PPT 的选手参加", "是否作为选手参加", "报名身份", "角色"],
  stage: ["Coding 阶段", "Coding阶段", "阶段", "当前阶段"],
  keywords: ["fld7dfyOMd", "请用三个词来描述你自己", "三个描述词", "描述词", "关键词", "标签"],
  demoTitle: ["Demo 名称", "Demo名称", "项目名称", "作品名称"],
  demoDescription: ["fldFCbRlDT", "最近一个月在VibeCoding啥产品呀？", "最近一个月在VibeCoding啥产品呀...", "Demo 简介", "Demo说明", "项目简介", "作品简介", "简介"],
  demoUrl: ["Demo 链接", "Demo链接", "项目链接", "作品链接", "链接"]
};

const DEFAULT_TOPICS = [
  {
    id: "t01",
    title: "给杭州的一次现场协作做一个最小工具",
    summary: "围绕当天真实活动场景，做一个能立刻帮大家减少混乱的小工具。",
    pptNo: "PPT-01",
    pptFile: "PPT-01-hangzhou-collaboration.pptx"
  },
  {
    id: "t02",
    title: "把报名表变成现场节奏控制台",
    summary: "从表单数据出发，设计一个主持人当天能稳定操作的控制界面。",
    pptNo: "PPT-02",
    pptFile: "PPT-02-event-control.pptx"
  },
  {
    id: "t03",
    title: "为 Lightning Talk 做一个 Demo 展示入口",
    summary: "让随机 Demo 环节更容易打开、投屏、记录和切换。",
    pptNo: "PPT-03",
    pptFile: "PPT-03-demo-showcase.pptx"
  }
];

export async function buildHangzhouEventData(config = envConfig()) {
  const fieldAliases = normalizeFieldAliases(config.fieldAliases);
  const records = config.mockRecordsPath
    ? await readMockRecords(config.mockRecordsPath)
    : await fetchFeishuBaseRecords(config, fieldAliases);
  const topics = await loadTopics(config.topicsFile);
  const participants = records
    .map((record, index) => recordToParticipant(record, index, fieldAliases))
    .filter(Boolean);

  return {
    meta: {
      title: config.eventTitle || "杭州线下赛",
      source: "FEISHU",
      syncedAt: new Date().toISOString(),
      responseCount: records.length
    },
    participants,
    topics
  };
}

export function envConfig(env = process.env) {
  return {
    appId: env.FEISHU_APP_ID || "",
    appSecret: env.FEISHU_APP_SECRET || "",
    appToken: env.FEISHU_BITABLE_APP_TOKEN || "",
    tableId: env.FEISHU_BITABLE_TABLE_ID || "",
    viewId: env.FEISHU_BITABLE_VIEW_ID || "",
    baseUrl: stripTrailingSlash(env.FEISHU_BASE_URL || "https://open.feishu.cn"),
    outputPath: env.FEISHU_OUTPUT_PATH || "hangzhou-event-data.json",
    topicsFile: env.HANGZHOU_TOPICS_FILE || "hangzhou-event-data.sample.json",
    eventTitle: env.HANGZHOU_EVENT_TITLE || "杭州线下赛",
    mockRecordsPath: env.FEISHU_MOCK_RECORDS_PATH || "",
    fieldIds: parseAliases(env.FEISHU_SYNC_FIELD_IDS),
    fieldAliases: {
      nickname: parseAliases(env.FEISHU_FIELD_NICKNAME),
      presence: parseAliases(env.FEISHU_FIELD_PRESENCE),
      role: parseAliases(env.FEISHU_FIELD_ROLE),
      stage: parseAliases(env.FEISHU_FIELD_STAGE),
      keywords: parseAliases(env.FEISHU_FIELD_KEYWORDS),
      demoTitle: parseAliases(env.FEISHU_FIELD_DEMO_TITLE),
      demoDescription: parseAliases(env.FEISHU_FIELD_DEMO_DESCRIPTION),
      demoUrl: parseAliases(env.FEISHU_FIELD_DEMO_URL)
    }
  };
}

export async function writeEventData(data, outputPath) {
  const resolved = path.resolve(outputPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return resolved;
}

async function fetchFeishuBaseRecords(config, fieldAliases) {
  requireValue(config.appId, "FEISHU_APP_ID");
  requireValue(config.appSecret, "FEISHU_APP_SECRET");
  requireValue(config.appToken, "FEISHU_BITABLE_APP_TOKEN");
  requireValue(config.tableId, "FEISHU_BITABLE_TABLE_ID");

  const token = await fetchTenantAccessToken(config);
  const fieldIds = projectedFieldIds(config, fieldAliases);
  const records = [];
  const limit = 200;
  let offset = 0;

  do {
    const url = new URL(`${config.baseUrl}/open-apis/base/v3/bases/${config.appToken}/tables/${config.tableId}/records`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    if (config.viewId) url.searchParams.set("view_id", config.viewId);
    fieldIds.forEach(fieldId => url.searchParams.append("field_id", fieldId));

    const payload = await feishuFetch(url.href, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = payload.data || {};
    const items = extractRecordItems(data);
    records.push(...items);
    offset += items.length || limit;
    if (!data.has_more) break;
  } while (true);

  return records;
}

function extractRecordItems(data) {
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.records)) return data.records;
  if (Array.isArray(data.fields) && Array.isArray(data.data)) {
    return rowsToRecords(data.fields, data.data, data.record_id_list, data.field_id_list);
  }
  return [];
}

function projectedFieldIds(config, fieldAliases) {
  if (Array.isArray(config.fieldIds) && config.fieldIds.length) {
    return unique(config.fieldIds);
  }

  const customAliases = Object.values(config.fieldAliases || {}).flat();
  if (customAliases.length) return unique(customAliases);

  return unique([
    fieldAliases.nickname[0],
    fieldAliases.presence[0],
    fieldAliases.role[0],
    fieldAliases.keywords[0],
    fieldAliases.demoDescription[0]
  ]);
}

async function fetchTenantAccessToken(config) {
  const payload = await feishuFetch(`${config.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret
    })
  });
  const token = payload.tenant_access_token || payload.data?.tenant_access_token;
  if (!token) throw new Error("Feishu did not return tenant_access_token.");
  return token;
}

async function feishuFetch(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Feishu HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (payload.code && payload.code !== 0) {
    throw new Error(`Feishu API ${payload.code}: ${payload.msg || payload.message || "unknown error"}`);
  }
  return payload;
}

async function readMockRecords(mockRecordsPath) {
  const raw = await fs.readFile(path.resolve(mockRecordsPath), "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.fields) && Array.isArray(parsed.data)) {
    return rowsToRecords(parsed.fields, parsed.data, parsed.record_id_list, parsed.field_id_list);
  }
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.records)) return parsed.records;
  if (Array.isArray(parsed.data?.fields) && Array.isArray(parsed.data?.data)) {
    return rowsToRecords(parsed.data.fields, parsed.data.data, parsed.data.record_id_list, parsed.data.field_id_list);
  }
  if (Array.isArray(parsed.data?.items)) return parsed.data.items;
  throw new Error("Mock records file must contain an array, items, records, or data.items.");
}

function rowsToRecords(fields, rows, recordIds = [], fieldIds = []) {
  return rows.map((row, index) => ({
    record_id: recordIds[index] || `row_${index + 1}`,
    fields: Object.fromEntries(
      fields.flatMap((field, fieldIndex) => {
        const entries = [[field, row[fieldIndex]]];
        if (fieldIds[fieldIndex]) entries.push([fieldIds[fieldIndex], row[fieldIndex]]);
        return entries;
      })
    )
  }));
}

async function loadTopics(topicsFile) {
  let parsed;
  try {
    const raw = await fs.readFile(path.resolve(topicsFile), "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    parsed = { topics: DEFAULT_TOPICS };
  }
  const topics = Array.isArray(parsed) ? parsed : parsed.topics;
  if (!Array.isArray(topics) || !topics.length) {
    throw new Error(`${topicsFile} must contain a non-empty topics array.`);
  }
  return topics.map((topic, index) => ({
    id: stringOr(topic.id, `t${String(index + 1).padStart(2, "0")}`),
    title: stringOr(topic.title || topic.name, `主题 ${index + 1}`),
    summary: stringOr(topic.summary || topic.description, ""),
    pptNo: stringOr(topic.pptNo || topic.no || topic.code, `PPT-${String(index + 1).padStart(2, "0")}`),
    pptFile: stringOr(topic.pptFile || topic.file || topic.filename, "")
  }));
}

function recordToParticipant(record, index, fieldAliases) {
  const fields = record.fields || record;
  const nickname = pickField(fields, fieldAliases.nickname);
  if (!nickname) return null;
  const role = normalizeRole(pickField(fields, fieldAliases.role));
  const stage = stringOr(pickField(fields, fieldAliases.stage), role.label);

  return {
    id: stableParticipantId(record, index),
    nickname,
    presence: normalizePresence(pickField(fields, fieldAliases.presence)),
    role: role.label,
    eligibleForDraw: role.eligibleForDraw,
    stage,
    keywords: splitKeywords(pickField(fields, fieldAliases.keywords)),
    demo: {
      title: stringOr(pickField(fields, fieldAliases.demoTitle), ""),
      description: stringOr(pickField(fields, fieldAliases.demoDescription), ""),
      url: stringOr(pickField(fields, fieldAliases.demoUrl), "")
    }
  };
}

function pickField(fields, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(fields, alias)) {
      return stringifyField(fields[alias]);
    }
  }

  const wanted = new Set(aliases.map(normalizeFieldName));
  const entry = Object.entries(fields).find(([key]) => wanted.has(normalizeFieldName(key)));
  return entry ? stringifyField(entry[1]) : "";
}

function stringifyField(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(stringifyField).filter(Boolean).join("、");
  }
  if (typeof value === "object") {
    if (value.text != null) return stringifyField(value.text);
    if (value.name != null) return stringifyField(value.name);
    if (value.value != null) return stringifyField(value.value);
    if (value.link != null) return stringifyField(value.link);
    if (value.url != null) return stringifyField(value.url);
    if (value.email != null) return "";
    if (value.phone != null) return "";
  }
  return "";
}

function splitKeywords(value) {
  const text = stringOr(value, "");
  if (!text) return [];
  return text
    .split(/[,，、/｜|;；\n\r\t\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizePresence(value) {
  const text = stringOr(value, "线下");
  if (/线上|online/i.test(text)) return "线上";
  if (/线下|到场|现场|offline/i.test(text)) return "线下";
  return text;
}

function normalizeRole(value) {
  const text = stringOr(value, "");
  if (!text) return { label: "观众/参与者", eligibleForDraw: false };
  if (/不|否|观众|旁听|只.*看|不参加|no/i.test(text)) {
    return { label: "观众/参与者", eligibleForDraw: false };
  }
  if (/还没定|待定|未定|不确定|暂定|unsure|maybe/i.test(text)) {
    return { label: text, eligibleForDraw: false };
  }
  if (/是|参加|报名|选手|乱讲|ppt|speaker|player|yes/i.test(text)) {
    return { label: "乱讲PPT选手", eligibleForDraw: true };
  }
  return { label: text, eligibleForDraw: false };
}

function stableParticipantId(record, index) {
  return stringOr(record.record_id || record.id, `p${String(index + 1).padStart(2, "0")}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || `p${String(index + 1).padStart(2, "0")}`;
}

function normalizeFieldAliases(aliases = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_FIELD_ALIASES).map(([key, defaults]) => {
      const custom = Array.isArray(aliases[key]) ? aliases[key] : [];
      return [key, [...custom, ...defaults].map(item => String(item).trim()).filter(Boolean)];
    })
  );
}

function parseAliases(value) {
  return String(value || "")
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values.map(item => String(item || "").trim()).filter(Boolean)));
}

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function stringOr(value, fallback) {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function requireValue(value, name) {
  if (!value) throw new Error(`Missing ${name}.`);
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
