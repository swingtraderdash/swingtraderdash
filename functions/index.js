const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const fs = require("fs");
const path = require("path");

setGlobalOptions({ maxInstances: 10 });

// 🔐 Existing homepage gatekeeper — leave untouched
exports.pageGatekeeper = onRequest((req, res) => {
  logger.info(`Incoming request path: ${req.path}`, { structuredData: true });

  if (req.path === "/newpage.html") {
    logger.info("✅ Valid page hit detected", { structuredData: true });
    res.status(200).send("Access granted");
  } else {
    logger.warn("🚫 Unauthorized access attempt", { structuredData: true });
    res.status(403).send("Access denied");
  }
});

// 🧪 New trial page gatekeeper — fully isolated
exports.trialPageGatekeeper = onRequest((req, res) => {
  logger.info(`[TrialPage] Incoming request`, { structuredData: true });

  // Simulated login check — replace with real auth later
  const isLoggedIn = req.headers.cookie && req.headers.cookie.includes("auth=true");

  if (!isLoggedIn) {
    logger.warn("[TrialPage] 🚫 Access denied");
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
  const htmlPath = path.join(__dirname, "templates", "trialpage.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  logger.info("[TrialPage] ✅ Access granted");
  res.status(200).send(html);
});
