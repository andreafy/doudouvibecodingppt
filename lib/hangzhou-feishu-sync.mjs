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
    id: "player001",
    pptNo: "PPT001",
    title: "VibeCoding有歌声",
    summary: "三分钟内讲清楚这些奇怪的美好事物",
    pptFile: "PPT001-喜牛牛-康定斯基论点线面.pdf",
    submitterId: "rec27gyk6yiwfk",
    submitterName: "沉默的喜牛牛",
    status: "approved",
    enabled: true
  },
  {
    id: "player002",
    pptNo: "PPT002",
    title: "爱、死亡和VibeCoding",
    summary: "在爱里冲动，在死亡中重生",
    pptFile: "PPT002-lapiko-我以为我在写代码，其实我在写一封很长的情书.pdf",
    submitterId: "rec27gytougwsw",
    submitterName: "lapiko",
    status: "approved",
    enabled: true
  },
  {
    id: "player003",
    pptNo: "PPT003",
    title: "如何看待 AI Coding 取代传统 (Ctrl+) CV 编程范式",
    summary: "AI Coding 如何改写人类搬砖文明",
    pptFile: "PPT003-who is it.pdf",
    submitterId: "rec27gz3rgk75s",
    submitterName: "HanZephyr",
    status: "approved",
    enabled: true
  },
  {
    id: "player004",
    pptNo: "PPT004",
    title: "花60s,克隆一个不用睡觉的你",
    summary: "问题来了：谁是正版？",
    pptFile: "PPT004-seede-1_奥特曼穿搭启示.pdf",
    submitterId: "rec27h3seisuid",
    submitterName: "panda",
    status: "approved",
    enabled: true
  },
  {
    id: "player005",
    pptNo: "PPT005",
    title: "",
    summary: "",
    pptFile: "",
    submitterId: "rec27hgxifgmxy",
    submitterName: "阿巧",
    status: "draft",
    enabled: false
  },
  {
    id: "player006",
    pptNo: "PPT006",
    title: "Vibe to backroom",
    summary: "当 AI 编程把我送进赛博后室",
    pptFile: "PPT006-后室.pdf",
    submitterId: "rec27jfnvir4x2",
    submitterName: "牧宇",
    status: "approved",
    enabled: true
  },
  {
    id: "player007",
    pptNo: "PPT007",
    title: "与其内耗，不如自爆",
    summary: "AI 时代的精神朋克宣言",
    pptFile: "PPT007-大叉-情绪稳定地发疯.pdf",
    submitterId: "rec27hfvmsjlrn",
    submitterName: "蔡大叉",
    status: "approved",
    enabled: true
  },
  {
    id: "player008",
    pptNo: "PPT008",
    title: "兜总我带来了一个 PPT",
    summary: "当代优秀青年汇报表演学",
    pptFile: "PPT008-鹤仔-页面的层次感.pdf",
    submitterId: "rec27hgegogpli",
    submitterName: "鹤仔",
    status: "approved",
    enabled: true
  },
  {
    id: "public001",
    pptNo: "PPT009",
    title: "Vibe Coding与谈恋爱的相似性：开始都说懂我，后来都不理我！",
    summary: "论人类如何从甲方进化为急诊科常客",
    pptFile: "PPT009-假如佛得角全员来踢苏超.pdf",
    submitterId: "",
    submitterName: "public",
    status: "approved",
    enabled: true
  },
  {
    id: "public002",
    pptNo: "PPT010",
    title: "论Vibe Coding与健身亲子鉴定匹配度高达99.9999%的合理性",
    summary: "真正困难的从来不是开始",
    pptFile: "PPT010-主动失业的家庭主夫是AINative时代绩优股.pdf",
    submitterId: "",
    submitterName: "public",
    status: "approved",
    enabled: true
  },
  {
    id: "public003",
    pptNo: "PPT011",
    title: "我写 Prompt 的样子，像极了前任跟我解释“我不是这个意思”",
    summary: "原来，我是在给模型做情绪陪护",
    pptFile: "PPT011-职场打工人的人生是一场修行_乱讲PPT.pdf",
    submitterId: "",
    submitterName: "public",
    status: "approved",
    enabled: true
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
    topicsFile: env.HANGZHOU_TOPICS_FILE || "hangzhou-event-topics.json",
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
  return topics.map((topic, index) => {
    const status = stringOr(topic.status || topic.reviewStatus || topic.state, "approved");
    return {
      id: stringOr(topic.id, `t${String(index + 1).padStart(2, "0")}`),
      title: stringOr(topic.title || topic.name, `主题 ${index + 1}`),
      summary: stringOr(topic.summary || topic.description, ""),
      pptNo: stringOr(topic.pptNo || topic.no || topic.code, `PPT-${String(index + 1).padStart(2, "0")}`),
      pptFile: stringOr(topic.pptFile || topic.file || topic.filename, ""),
      submitterId: normalizeParticipantRef(topic.submitterId || topic.submitter_id || topic.playerId || topic.player_id || topic.ownerId || topic.owner_id),
      submitterName: stringOr(topic.submitterName || topic.submitter || topic.playerName || topic.ownerName || topic.nickname, ""),
      status,
      enabled: topic.enabled !== false && !/禁用|不展示|取消|disabled|hidden|off/i.test(status)
    };
  });
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

function normalizeParticipantRef(value) {
  return String(value || "").trim().toLowerCase();
}

function requireValue(value, name) {
  if (!value) throw new Error(`Missing ${name}.`);
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
