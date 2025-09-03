const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// 🔐 Unified gatekeeper for all token-protected pages
exports.pageGatekeeper = onRequest(async (req, res) => {
  logger.info(`Incoming request path: ${req.path}`, { structuredData: true });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("🚫 Missing or invalid Authorization header", { structuredData: true });
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Denied</title></head>
        <body>
          <h1>Access Denied</h1>
          <p>No valid token provided. You must be logged in to view this page.</p>
        </body>
      </html>
    `);
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    logger.info(`✅ Token verified for UID: ${decodedToken.uid}`, { structuredData: true });

    // Dynamically resolve page name from request path
    const pageName = req.path.replace("/", "") + ".html";
    const htmlPath = path.join(__dirname, "templates", pageName);

    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, "utf8");
      logger.info(`✅ Access granted to ${pageName}`, { structuredData: true });
      return res.status(200).send(html);
    } else {
      logger.warn(`🚫 Requested page not found: ${pageName}`, { structuredData: true });
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Page Not Found</title></head>
          <body>
            <h1>404 - Page Not Found</h1>
            <p>The requested page does not exist.</p>
          </body>
        </html>
      `);
    }

  } catch (error) {
    logger.error("❌ Token verification failed", { error });
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Denied</title></head>
        <body>
          <h1>Access Denied</h1>
          <p>Token verification failed. Please log in again.</p>
        </body>
      </html>
    `);
  }
});
