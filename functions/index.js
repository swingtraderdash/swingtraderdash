const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const fs = require("fs");
const path = require("path");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

exports.pageGatekeeper = onRequest((req, res) => {
  cors(req, res, async () => {
    logger.info(`Incoming request path: ${req.path}`, { structuredData: true });

    const sessionCookie = req.cookies ? req.cookies.__session : null;
    let decodedToken;

    if (sessionCookie) {
      logger.info("🔍 Raw session cookie received", { cookie: sessionCookie });
      try {
        decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);
        logger.info(`✅ Session cookie verified for UID: ${decodedToken.uid}`, { structuredData: true });
      } catch (error) {
        logger.warn("❌ Invalid session cookie", {
          error: error.message,
          stack: error.stack,
          cookie: sessionCookie || 'No cookie found'
        });
      }
    }

    if (!decodedToken) {
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
        decodedToken = await admin.auth().verifyIdToken(idToken);
        logger.info(`✅ Token verified for UID: ${decodedToken.uid}`, { structuredData: true });
      } catch (error) {
        logger.error("❌ Token verification failed", {
          error: error.message,
          stack: error.stack,
          token: idToken
        });
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
    }

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
  });
});

exports.sessionLogin = onRequest((req, res) => {
  cors(req, res, async () => {
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk;
    });

    req.on('end', async () => {
      try {
        const { idToken } = JSON.parse(rawBody);
        const expiresIn = 60 * 60 * 24 * 5 * 1000;

        const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
        const options = {
          maxAge: expiresIn,
          httpOnly: true,
          secure: true
        };

        res.cookie('__session', sessionCookie, options);
        res.status(200).send({ status: 'success' });
      } catch (error) {
        logger.error("❌ Failed to create session cookie", {
          error: error.message,
          stack: error.stack
        });
        res.status(401).send('Unauthorized');
      }
    });
  });
});