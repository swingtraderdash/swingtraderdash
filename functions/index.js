const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");
const fs = require('fs').promises;
const path = require('path');
const fetch = require("node-fetch");

admin.initializeApp();

// Clean up orphaned functions
exports.pageGatekeeper = functions.https.onRequest((req, res) => {
  logger.info('pageGatekeeper is deprecated and will be deleted');
  res.status(410).send('Function is deprecated');
});

exports.sessionLogin = functions.https.onRequest((req, res) => {
  logger.info('sessionLogin is deprecated and will be deleted');
  res.status(410).send('Function is deprecated');
});

exports.testFunction = functions.https.onRequest((req, res) => {
  logger.info('testFunction is deprecated and will be deleted');
  res.status(410).send('Function is deprecated');
});

// Protected page function for watchlist.html, set-new.html, manage.html, triggeredalerts.html
exports.protectedPage = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Authorization');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.info('No token provided, redirecting to /index.html');
    return res.redirect(302, '/index.html');
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    await admin.auth().verifyIdToken(idToken);
    logger.info('Token verified, serving protected page for:', req.path);

    const filePath = path.join(__dirname, 'protected', req.path.replace(/^\//, ''));
    logger.info('Attempting to serve file:', filePath);

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      logger.info('Serving file content for:', req.path, 'Content preview:', fileContent.substring(0, 100) + '...');
      res.status(200).set('Content-Type', 'text/html').send(fileContent);
    } catch (error) {
      logger.error('File read error for:', filePath, 'Error:', error.message);
      res.status(404).send('File not found');
    }
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.redirect(302, '/index.html');
  }
});

// 🔒 Secure backend function to fetch Tiingo metadata
exports.fetchTiingo = functions.https.onCall(async (data, context) => {
  const ticker = data.ticker;
  const TIINGO_API_KEY = functions.config().tiingo.key;

  if (!ticker) {
    throw new functions.https.HttpsError("invalid-argument", "Ticker is required.");
  }

  const url = `https://api.tiingo.com/tiingo/daily/${ticker}?token=${TIINGO_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Tiingo fetch failed: ${response.status}`);
    }

    const json = await response.json();
    return { success: true, data: json };
  } catch (err) {
    console.error("[Tiingo] fetch:error", err.message);
    throw new functions.https.HttpsError("internal", "Failed to fetch Tiingo data.");
  }
});
