const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");
const fs = require('fs').promises;
const path = require('path');

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

// Protected page function for watchlist.html
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
    logger.info('Token verified, serving protected page');

    const filePath = path.join(__dirname, 'protected', 'watchlist.html');
    const fileContent = await fs.readFile(filePath, 'utf8');
    res.status(200).send(fileContent);
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.redirect(302, '/index.html');
  }
});
