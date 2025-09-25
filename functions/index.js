const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");
const fs = require('fs').promises;
const path = require('path');
const fetch = require("node-fetch");
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

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

// Protected page function
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

// Fetch Tiingo metadata
exports.fetchTiingo = functions.https.onCall(async (data, context) => {
  const ticker = data.ticker;
  const TIINGO_API_KEY = functions.config().tiingo.key;

  if (!ticker || typeof ticker !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Ticker is required and must be a string.");
  }

  const url = `https://api.tiingo.com/tiingo/daily/${ticker}?token=${TIINGO_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Tiingo responded with status ${response.status}`);
    }

    const json = await response.json();
    logger.info(`[Tiingo] Raw response for ${ticker}: ${JSON.stringify(json)}`);

    if (!json.ticker || !json.name) {
      throw new Error("Missing expected Tiingo fields");
    }

    return {
      ticker: json.ticker,
      name: json.name
    };
  } catch (err) {
    logger.error(`[Tiingo] fetch:error for ${ticker}: ${err.message}`);
    throw new functions.https.HttpsError("internal", "Failed to fetch Tiingo data.");
  }
});

// Helper function to fetch and insert data
async function loadDataForTicker(ticker, startDate, endDate) {
  const TIINGO_API_KEY = functions.config().tiingo.key;
  const url = `https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${startDate}&endDate=${endDate}&token=${TIINGO_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Tiingo API error: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No data returned from Tiingo');
    }
    const rows = data.map(item => ({
      ticker_symbol: ticker,
      date: item.date,
      close: item.close,
      high: item.high,
      low: item.low,
      open: item.open,
      volume: item.volume
    }));
    const datasetId = 'swing_trader_data';
    const tableId = 'ticker_history';
    await bigquery
      .dataset(datasetId)
      .table(tableId)
      .insert(rows);
    logger.info(`Inserted ${rows.length} rows for ${ticker} into BigQuery`);
    return rows.length;
  } catch (error) {
    logger.error(`Error in loadDataForTicker for ${ticker}: ${error.message}`);
    throw error;
  }
}

// Fetch 10 years of historical data
exports.loadHistoricalData = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      const { ticker } = req.body;
      if (!ticker || typeof ticker !== 'string') {
        return res.status(400).send('Invalid or missing ticker');
      }

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 10);
      const formattedStartDate = startDate.toISOString().split('T')[0];

      const rowsInserted = await loadDataForTicker(ticker, formattedStartDate, endDate);
      return res.status(200).send(`Successfully inserted ${rowsInserted} rows for ${ticker}`);
    } catch (error) {
      logger.error(`Error in loadHistoricalData for ${ticker}: ${error.message}`);
      return res.status(500).send(`Error: ${error.message}`);
    }
  });

// Daily EOD data fetch
exports.loadDailyEODData = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .pubsub.schedule('every 24 hours')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const date = new Date().toISOString().split('T')[0];
    const tickers = ['GOOG', 'ABBV'];
    for (const ticker of tickers) {
      try {
        await loadDataForTicker(ticker, date, date);
      } catch (error) {
        logger.error(`Error in loadDailyEODData for ${ticker}: ${error.message}`);
      }
    }
    logger.info('loadDailyEODData completed for tickers:', tickers);
    return null;
  });