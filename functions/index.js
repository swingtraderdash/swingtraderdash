const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({
  origin: 'https://swingtraderdash-1a958.web.app',
  credentials: true
});
const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const fs = require("fs");
const path = require("path");

logger.info("[startup] Initializing Firebase Admin SDK");
try {
  admin.initializeApp();
  logger.info("[startup] ✅ Firebase Admin SDK initialized");
} catch (error) {
  logger.error("[startup] ❌ Firebase Admin SDK initialization failed", {
    error: error.message,
    stack: error.stack
  });
}
setGlobalOptions({ maxInstances: 10 });

exports.pageGatekeeper = onRequest((req, res) => {
  logger.info("[pageGatekeeper] 🌟 Function invoked", { method: req.method, headers: req.headers });
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

exports.sessionLogin = onRequest({ timeoutSeconds: 120 }, (req, res) => {
  logger.info("[sessionLogin] 🌟 Function invoked", { method: req.method, headers: req.headers });
  try {
    cors(req, res, async () => {
      logger.info("[sessionLogin] 🚀 Request received after CORS", { method: req.method, headers: req.headers });
      if (req.method !== 'POST') {
        logger.warn("[sessionLogin] 🚫 Invalid method", { method: req.method });
        return res.status(405).send('Method Not Allowed');
      }

      let rawBody = '';
      try {
        logger.info("[sessionLogin] 📥 Starting to read request body");
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request body read timeout')), 30000);
        });

        const bodyPromise = new Promise((resolve, reject) => {
          req.on('data', chunk => {
            rawBody += chunk;
            logger.info("[sessionLogin] 📥 Received chunk", { chunkLength: chunk.length, chunk: chunk.toString() });
          });
          req.on('end', () => resolve());
          req.on('error', err => reject(err));
        });

        await Promise.race([bodyPromise, timeoutPromise]);

        logger.info("[sessionLogin] 📥 Raw body received", { rawBody });
        let parsedBody;
        try {
          parsedBody = JSON.parse(rawBody || '{}');
          logger.info("[sessionLogin] ✅ JSON parsed", { parsedBody });
        } catch (error) {
          logger.error("[sessionLogin] ❌ JSON parse failed", {
            error: error.message,
            stack: error.stack,
            rawBody
          });
          return res.status(400).send('Invalid JSON body');
        }

        const { idToken } = parsedBody;
        if (!idToken) {
          logger.error("[sessionLogin] ❌ No idToken provided", { parsedBody });
          return res.status(400).send('No idToken provided');
        }
        logger.info("[sessionLogin] 🔍 Parsed idToken", { idToken: idToken.substring(0, 20) + '...' });

        // Temporarily bypass verifyIdToken to isolate timeout issue
        logger.info("[sessionLogin] ⏭️ Bypassing idToken verification for debugging");

        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        let sessionCookie;
        try {
          logger.info("[sessionLogin] 🔄 Attempting to create session cookie");
          sessionCookie = await Promise.race([
            admin.auth().createSessionCookie(idToken, { expiresIn }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Session cookie creation timeout')), 30000))
          ]);
          logger.info("[sessionLogin] ✅ Session cookie created", { sessionCookie: sessionCookie.substring(0, 20) + '...' });
        } catch (error) {
          logger.error("[sessionLogin] ❌ Session cookie creation failed", {
            error: error.message,
            stack: error.stack
          });
          return res.status(401).send('Failed to create session cookie');
        }

        res.set('Access-Control-Allow-Credentials', 'true');
        const options = {
          maxAge: expiresIn,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        };
        res.cookie('__session', sessionCookie, options);
        logger.info("[sessionLogin] 🍪 Cookie set", { cookieOptions: options });

        res.status(200).send({ status: 'success' });
        logger.info("[sessionLogin] ✅ Response sent", { status: 200 });
      } catch (error) {
        logger.error("[sessionLogin] ❌ Error processing request", {
          error: error.message,
          stack: error.stack
        });
        res.status(500).send('Error processing request');
      }
    });
  } catch (error) {
    logger.error("[sessionLogin] ❌ Error before CORS middleware", {
      error: error.message,
      stack: error.stack
    });
    res.status(500).send('Server error before CORS');
  }
});
