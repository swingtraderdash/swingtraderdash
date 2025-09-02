const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const fs = require("fs");
const path = require("path");

setGlobalOptions({ maxInstances: 10 });

// 🔐 Unified gatekeeper for homepage and trial page
exports.pageGatekeeper = onRequest((req, res) => {
  logger.info(`Incoming request path: ${req.path}`, { structuredData: true });

  // Simulated login check — replace with real auth later
  const isLoggedIn = req.headers.cookie && req.headers.cookie.includes("auth=true");
  if (!isLoggedIn) {
    logger.warn("🚫 Access denied — not logged in", { structuredData: true });
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Denied</title></head>
        <body>
          <h1>Access Denied</h1>
          <p>You must be logged in to view this page.</p>
        </body>
      </html>
    `);
  }

  // ✅ Serve the gated trial page
  if (req.path === "/trialpage") {
    const htmlPath = path.join(__dirname, "templates", "trialpage.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    logger.info("✅ Access granted to /trialpage", { structuredData: true });
    return res.status(200).send(html);
  }

  // 🚫 All other paths denied
  logger.warn("🚫 Unauthorized access attempt to unknown path", { structuredData: true });
  res.status(403).send("Access denied");
});
