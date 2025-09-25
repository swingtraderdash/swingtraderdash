import { onRequest, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { BigQuery } from '@google-cloud/bigquery';
import { protectedPageGen2 } from './protectedPageGen2.js';

const bigquery = new BigQuery();
initializeApp();

// Clean up orphaned functions
export const pageGatekeeper = onRequest((req, res) => {
  logger.info('pageGatekeeper is deprecated and will be deleted');
  res.status(410).send('Function is deprecated');
});

export const sessionLogin = onRequest((req, res) => {
  logger.info('sessionLogin is deprecated and will be deleted');
  res.status(410).send('Function is deprecated');
});

export const testFunction = onRequest((req, res) => {
  logger.info('testFunction is deprecated and will be deleted');
  res.status(410).send('Function is deprecated');
});

// Protected page function (Gen 1)
export const protectedPage = onRequest(async (req, res) => {
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
    await getAuth().verifyIdToken(idToken);
    logger.info('Token verified, serving protected page for:', req.path);

    const filePath = path.join(__dirname, 'protected', req.path.replace(/^\//, ''));
    logger.info('Attempting to serve file:', filePath);

    try {
      const fileContent = await readFile(filePath, 'utf8');
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
export const fetchTiingo = onCall(async (data, context) => {
  const ticker = data.ticker;
  const TIINGO_API_KEY = process.env.TIINGO_API_KEY;

  if (!ticker || typeof ticker !== "string") {
    throw new Error("Ticker is required and must be a string.");
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
    throw new Error("Failed to fetch Tiingo data.");
  }
});

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

// Gen 2 function export
export { protectedPageGen2 };

   
