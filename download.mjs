import https from "https";
import fs from "fs";

https.get(
  "https://raw.githubusercontent.com/aiagenta2z/mcp-marketplace/main/data/config/merge_mcp_config.json",
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      fs.writeFileSync("merge_mcp_config.json", data);
      const parsed = JSON.parse(data);
      console.log("Saved servers count:", Object.keys(parsed.mcpServers).length);
    });
  },
);
