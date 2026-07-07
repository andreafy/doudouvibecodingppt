#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const inputPath = process.argv[2] || "hangzhou-event-data.sample.json";
const resolvedPath = path.resolve(inputPath);

try {
  const raw = await fs.readFile(resolvedPath, "utf8");
  const data = JSON.parse(raw);
  const result = validateEventData(data);
  printResult(result, resolvedPath);
  process.exitCode = result.errors.length ? 1 : 0;
} catch (error) {
  console.error(`Failed to validate ${resolvedPath}: ${error.message}`);
  process.exitCode = 1;
}

function validateEventData(data) {
  const participants = Array.isArray(data.participants) ? data.participants.map(normalizeParticipant) : [];
  const topics = Array.isArray(data.topics) ? data.topics.map(normalizeTopic) : [];
  const errors = [];
  const warnings = [];

  if (!participants.length) errors.push("participants is empty.");
  if (!topics.length) errors.push("topics is empty.");

  duplicateIds(participants).forEach(id => errors.push(`Duplicate participant id: ${id}`));
  duplicateIds(topics).forEach(id => errors.push(`Duplicate topic id: ${id}`));

  const participantIds = new Set(participants.map(participant => participant.id));
  topics.forEach(topic => {
    if (topic.enabled && !topic.title) errors.push(`Topic ${topic.id} is missing title.`);
    if (topic.enabled && !topic.pptFile) errors.push(`Topic ${topic.id} is missing pptFile.`);
    if (!topic.submitterId) {
      warnings.push(`Topic ${topic.id} has no submitterId and will be treated as a public topic.`);
      return;
    }
    if (!participantIds.has(topic.submitterId)) {
      errors.push(`Topic ${topic.id} submitterId ${topic.submitterId} does not match any participant id.`);
    }
  });

  const speakers = participants.filter(isEligibleSpeaker);
  const enabledTopics = topics.filter(topic => topic.enabled);
  if (enabledTopics.length < speakers.length) {
    errors.push(`Enabled topics (${enabledTopics.length}) are fewer than eligible speakers (${speakers.length}).`);
  }

  const plan = errors.length ? null : generateLegalDrawPlan(speakers, enabledTopics);
  if (!plan && !errors.length) {
    errors.push("Cannot generate a non-self draw plan. Add public topics or adjust submitterId values.");
  }

  return { participants, topics, speakers, enabledTopics, plan, errors, warnings };
}

function normalizeParticipant(participant, index) {
  return {
    ...participant,
    id: normalizeRef(participant.id || `p${String(index + 1).padStart(2, "0")}`),
    nickname: stringOr(participant.nickname || participant.name, `报名者 ${index + 1}`)
  };
}

function normalizeTopic(topic, index) {
  const status = stringOr(topic.status || topic.reviewStatus || topic.state, "approved");
  return {
    ...topic,
    id: stringOr(topic.id, `t${String(index + 1).padStart(2, "0")}`),
    title: stringOr(topic.title || topic.name, ""),
    pptFile: stringOr(topic.pptFile || topic.file || topic.filename, ""),
    submitterId: normalizeRef(topic.submitterId || topic.submitter_id || topic.playerId || topic.player_id || topic.ownerId || topic.owner_id),
    enabled: topic.enabled !== false && !/禁用|不展示|取消|disabled|hidden|off/i.test(status)
  };
}

function generateLegalDrawPlan(participants, topics) {
  const ordered = participants
    .map(participant => ({
      participant,
      candidates: topics
        .filter(topic => !sameRef(topic.submitterId, participant.id))
        .sort((a, b) => a.id.localeCompare(b.id))
    }))
    .sort((a, b) => a.candidates.length - b.candidates.length || a.participant.id.localeCompare(b.participant.id));
  if (ordered.some(item => !item.candidates.length)) return null;

  const usedTopicIds = new Set();
  const assignments = [];
  function assign(index) {
    if (index >= ordered.length) return true;
    const item = ordered[index];
    for (const topic of item.candidates) {
      if (usedTopicIds.has(topic.id)) continue;
      usedTopicIds.add(topic.id);
      assignments.push({ participantId: item.participant.id, topicId: topic.id });
      if (assign(index + 1)) return true;
      assignments.pop();
      usedTopicIds.delete(topic.id);
    }
    return false;
  }
  return assign(0) ? assignments : null;
}

function isEligibleSpeaker(participant) {
  if (participant.eligibleForDraw === false) return false;
  if (participant.eligibleForDraw === true) return true;
  return /乱讲PPT选手|选手|speaker|player/i.test(String(participant.role || ""));
}

function duplicateIds(items) {
  const seen = new Set();
  const duplicates = new Set();
  items.forEach(item => {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  });
  return Array.from(duplicates);
}

function printResult(result, filePath) {
  console.log(`Validated ${filePath}`);
  console.log(`Participants: ${result.participants.length}`);
  console.log(`Eligible speakers: ${result.speakers.length}`);
  console.log(`Enabled topics: ${result.enabledTopics.length}`);
  if (result.plan) {
    console.log("Non-self draw plan:");
    result.plan.forEach(item => console.log(`- ${item.participantId} -> ${item.topicId}`));
  }
  result.warnings.forEach(message => console.warn(`Warning: ${message}`));
  result.errors.forEach(message => console.error(`Error: ${message}`));
}

function normalizeRef(value) {
  return String(value || "").trim().toLowerCase();
}

function sameRef(left, right) {
  const normalizedLeft = normalizeRef(left);
  const normalizedRight = normalizeRef(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function stringOr(value, fallback) {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}
