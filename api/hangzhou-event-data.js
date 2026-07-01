module.exports = async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { buildHangzhouEventData, envConfig } = await import("../lib/hangzhou-feishu-sync.mjs");
    const data = await buildHangzhouEventData(envConfig());
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(200).json(data);
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "Failed to sync Hangzhou event data",
      message: error.message
    });
  }
};
