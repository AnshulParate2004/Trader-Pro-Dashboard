// Local Background Runner for Setup 1H-A Paper Executor
// Triggers /api/cron/paper-1h-a at minute 1 of every hour

const http = require("http");

function triggerCron() {
  const url = "http://localhost:3000/api/cron/paper-1h-a";
  console.log(`[${new Date().toISOString()}] Triggering paper 1H-A cron...`);
  http.get(url, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      console.log(`[${new Date().toISOString()}] Response:`, data);
    });
  }).on("error", (err) => {
    console.warn(`[${new Date().toISOString()}] Error triggering cron:`, err.message);
  });
}

// Check every minute if minute === 1
setInterval(() => {
  const now = new Date();
  if (now.getUTCMinutes() === 1) {
    triggerCron();
  }
}, 60000);

console.log("Paper 1H-A Cron Runner initialized. Schedule: '1 * * * *' (Minute 1 of every hour UTC).");
