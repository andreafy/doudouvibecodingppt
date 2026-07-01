#!/usr/bin/env node
import { buildHangzhouEventData, envConfig, writeEventData } from "../lib/hangzhou-feishu-sync.mjs";

async function main() {
  const config = envConfig();
  const data = await buildHangzhouEventData(config);
  const output = await writeEventData(data, config.outputPath);
  console.log(`Synced ${data.participants.length} participants to ${output}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
