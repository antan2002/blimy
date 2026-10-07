const fs = require("fs");
fetch("https://api.github.com/repos/modelcontextprotocol/servers/contents/src")
  .then((r) => r.json())
  .then((data) => {
    if (!Array.isArray(data)) return console.error(data);
    const servers = data.filter((d) => d.type === "dir").map((d) => d.name);
    console.log(servers);
  })
  .catch(console.error);
