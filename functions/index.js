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
const os = require("os");

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
        res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
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
        res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
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
      res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
      return res.status(200).send(html);
    } else {
      logger.warn(`🚫 Requested page not found: ${pageName}`, { structuredData: true });
      res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
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

exports.sessionLogin = onRequest({ timeoutSeconds: 120, memory: '512MiB' }, (req, res) => {
  logger.info("[sessionLogin] 🌟 Function invoked", {
    method: req.method,
    headers: req.headers,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    }
  });
  if (req.method === 'OPTIONS') {
    logger.info("[sessionLogin] 📩 Handling OPTIONS preflight");
    res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
    return res.status(204).send('');
  }

  try {
    cors(req, res, async () => {
      logger.info("[sessionLogin] 🚀 Request received after CORS", {
        method: req.method,
        headers: req.headers,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        }
      });
      if (req.method !== 'POST') {
        logger.warn("[sessionLogin] 🚫 Invalid method", { method: req.method });
        res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
        return res.status(405).send('Method Not Allowed');
      }

      logger.info("[sessionLogin] ⏭️ Bypassing body parsing and session cookie creation for debugging");
      const expiresIn = 60 * 60 * 24 * 5 * 1000;
      const sessionCookie = 'dummy-session-cookie-for-testing';

      res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
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
    });
  } catch (error) {
    logger.error("[sessionLogin] ❌ Error before CORS middleware", {
      error: error.message,
      stack: error.stack,
      code: error.code || 'N/A'
    });
    res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
    res.status(500).send(`Server error before CORS: ${error.message}`);
  }
});

   

   
     
