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

// Fetch 10 years of historical data and store in BigQuery
exports.loadHistoricalData = functions.https.onRequest(async (req, res) => {
  try {
    // Handle POST request with ticker in body
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    const { ticker } = req.body;
    if (!ticker || typeof ticker !== 'string') {
      return res.status(400).send('Invalid or missing ticker');
    }

    const TIINGO_API_KEY = functions.config().tiingo.key;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 10); // 10 years of data
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    // Check existing dates in BigQuery to avoid duplicates
    const datasetId = 'swing_trader_data';
    const tableId = 'ticker_history';
    const query = `
      SELECT DISTINCT date
      FROM \`${datasetId}.${tableId}\`
      WHERE ticker_symbol = @ticker
    `;
    const options = {
      query: query,
      params: { ticker: ticker.toUpperCase() },
    };
    const [rows] = await bigquery.query(options);
    const existingDates = rows.map(row => row.date.value.split('T')[0]);

    // Fetch historical data from Tiingo
    const url = `https://api.tiingo.com/tiingo/daily/${ticker.toLowerCase()}/prices?startDate=${formattedStartDate}&endDate=${formattedEndDate}&token=${TIINGO_API_KEY}`;
    let response;
    let retries = 3;
    while (retries > 0) {
      try {
        response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Tiingo responded with status ${response.status}`);
        }
        break;
      } catch (error) {
        if (error.message.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
        } else {
          throw error;
        }
      }
    }
    if (!response) {
      return res.status(404).send(`No historical data available for ${ticker}`);
    }
    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(404).send(`No historical data available for ${ticker}`);
    }

    // Filter out existing dates
    const newRows = data
      .filter(row => !existingDates.includes(row.date.split('T')[0]))
      .map(row => ({
        ticker_symbol: ticker.toUpperCase(),
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        adjClose: row.adjClose,
        last_updated: new Date().toISOString(),
      }));

    // Insert new rows into BigQuery
    if (newRows.length > 0) {
      await bigquery
        .dataset(datasetId)
        .table(tableId)
        .insert(newRows);
      logger.info(`Inserted ${newRows.length} rows for ${ticker}`);
      return res.status(200).send(`Successfully loaded ${newRows.length} rows for ${ticker}`);
    } else {
      logger.info(`No new rows to load for ${ticker}`);
      return res.status(200).send(`No new rows to load for ${ticker}`);
    }
  } catch (error) {
    logger.error('Error in loadHistoricalData:', error);
    return res.status(500).send(`Error: ${error.message}`);
  }
});
