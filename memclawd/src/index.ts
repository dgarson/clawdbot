import { createServer as createHttpServer } from "node:http";
import pino from "pino";
import { createServer } from "./api/server.js";
import { loadConfig } from "./config/schema.js";

const config = loadConfig();
const logger = pino({
  level: process.env.MEMCLAWD_LOG_LEVEL ?? config.observability.logging.level,
});

const app = createServer({ logger, config });

const server = createHttpServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const body = req.method && ["GET", "HEAD"].includes(req.method) ? undefined : req;
  const request = new Request(requestUrl, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body,
  });

  const response = await app.fetch(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const arrayBuffer = await response.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
});

server.listen(config.server.port, config.server.host, () => {
  logger.info(
    {
      host: config.server.host,
      port: config.server.port,
      basePath: config.server.basePath,
    },
    "MemClawd server listening",
  );
});
