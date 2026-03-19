const fs = require("fs");
const outPath = "D:\\maestro2\\dashboard\\.workflow\\.analysis\\ANL-agent-sdk-issue-monitor-tool-2026-03-19\\exploration-codebase.json";
const d = {msg: "test"};
fs.writeFileSync(outPath, JSON.stringify(d, null, 2), "utf8");
console.log("OK");