// Firebase Functions and Admin SDK
import { onRequest, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'fs/promises';
import fetch from 'node-fetch';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

// Initialize BigQuery and Firebase Admin
const bigquery = new BigQuery();
initializeApp();

// Helper function to fetch and insert data
async function loadDataForTicker(ticker, startDate, endDate) {
  const TIINGO_API_KEY = process.env.TIINGO_API_KEY;
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

// Fetch Tiingo metadata
export const fetchTiingo = onCall(
  { region: 'us-central1' },
  async (request) => {
    const ticker = request.data.ticker;
    const TIINGO_API_KEY = process.env.TIINGO_API_KEY;

    if (!ticker || typeof ticker !== 'string') {
      throw new Error('Ticker is required and must be a string.');
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
        throw new Error('Missing expected Tiingo fields');
      }

      return {
        ticker: json.ticker,
        name: json.name
      };
    } catch (err) {
      logger.error(`[Tiingo] fetch:error for ${ticker}: ${err.message}`);
      throw new Error('Failed to fetch Tiingo data.');
    }
  }
);

// Daily EOD data fetch
export const loadDailyEODData = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'us-central1',
    timeZone: 'America/New_York'
  },
  async (event) => {
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
  }
);

// Fetch 10 years of historical data
export const loadHistoricalData = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '1GB'
  },
  async (req, res) => {
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
  }
);

// Protected page function with logging
export const protectedPage = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Authorization');

    logger.info("🔐 protectedPage triggered");

    const authHeader = req.headers.authorization;
    logger.info("📡 Authorization header:", authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn("🚫 Missing or malformed Authorization header");
      return res.redirect(302, '/index.html');
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      logger.info("✅ Token verified for UID:", decoded.uid);

      const filePath = path.join(__dirname, 'protected', req.path.replace(/^\//, ''));
      logger.info("📄 Serving file:", filePath);

      const fileContent = await readFile(filePath, 'utf8');
      res.status(200).set('Content-Type', 'text/html').send(fileContent);
    } catch (error) {
      logger.error("🚫 Token verification failed:", error.message);
      res.redirect(302, '/index.html');
    }
  }
);
