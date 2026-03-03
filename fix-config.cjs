const fs = require("fs");
const path = require("path");
const file = path.join(process.env.HOME, ".openclaw/openclaw.json");
const obj = JSON.parse(fs.readFileSync(file, "utf-8"));

if (obj.agents && Array.isArray(obj.agents.list)) {
  for (const agent of obj.agents.list) {
    if (agent.runtime === "claude") {
      agent.runtime = "claude-sdk";
    }
    if ("claudeSdkOptions" in agent) {
      delete agent.claudeSdkOptions;
    }
  }
}
if ("debugging" in obj) {
  delete obj.debugging;
}

fs.writeFileSync(file, JSON.stringify(obj, null, 2));
console.log("Fixed config");
