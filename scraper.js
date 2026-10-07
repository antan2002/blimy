import https from "https";

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://mcpmarket.com/server/page/${page}`, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const match = data.match(/"itemListElement":(\[.*?\])/);
          if (match) {
            try {
              resolve(JSON.parse(match[1]));
            } catch (e) {
              resolve([]);
            }
          } else {
            resolve([]);
          }
        });
      })
      .on("error", reject);
  });
}

async function run() {
  let all = [];
  for (let i = 1; i <= 3; i++) {
    const items = await fetchPage(i);
    all = all.concat(items);
  }
  console.log(JSON.stringify(all, null, 2));
}

run();
