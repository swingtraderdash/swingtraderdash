import { onRequest, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile, unlink } from 'fs/promises';
import fetch from 'node-fetch';
import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import os from 'os';
import { defineSecret } from 'firebase-functions/params';

const TIINGO_API_KEY = defineSecret('TIINGO_API_KEY');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bigquery = new BigQuery();
initializeApp();

const corsHandler = cors({
  origin: ['https://www.swingtrader.co.uk'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

async function loadDataForTicker(ticker, startDate, endDate) {
  const apiKey = TIINGO_API_KEY.value();
  if (!apiKey) {
    logger.error('[Tiingo] API key missing from Firebase Secrets');
    throw new Error('Tiingo API key not configured');
  }
  logger.info(`[Tiingo] API key presence: ✅ Present`);

  const url = `https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${startDate}&endDate=${endDate}&token=${apiKey}`;
  logger.info(`[Tiingo] Historical fetch URL for ${ticker}: ${url}`);

  let response;
  try {
    response = await fetch(url);
    logger.info(`[Tiingo] Response status for ${ticker}: ${response.status}`);
  } catch (fetchErr) {
    logger.error(`[Tiingo] Fetch failed for ${ticker}: ${fetchErr.message}`, { error: fetchErr });
    throw new Error('Failed to reach Tiingo API');
  }

  let rawText;
  try {
    rawText = await response.text();
    logger.info(`[Tiingo] Raw response text for ${ticker}: ${rawText}`);
  } catch (textErr) {
    logger.error(`[Tiingo] Failed to read response text for ${ticker}: ${textErr.message}`, { error: textErr });
    throw new Error('Failed to read Tiingo response body');
  }

  let data;
  try {
    data = JSON.parse(rawText);
    logger.info(`[Tiingo] Parsed JSON for ${ticker}: ${JSON.stringify(data)}`);
  } catch (jsonErr) {
    logger.error(`[Tiingo] JSON parse failed for ${ticker}: ${jsonErr.message}`, { error: jsonErr });
    throw new Error('Failed to parse Tiingo response');
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No data returned from Tiingo');
  }

  const rows = data.map(item => ({
    ticker_symbol: ticker,
    date: item.date.split('T')[0],
    close: item.close,
    high: item.high,
    low: item.low,
    open: item.open,
    volume: item.volume,
    adj_close: item.adjClose // Map Tiingo's adjClose to adj_close
  }));

  const datasetId = 'swing_trader_data';
  const tableId = 'ticker_history';
  const tempFilePath = path.join(os.tmpdir(), `ticker_data_${ticker}_${Date.now()}.json`);
  let rowsInserted;

  try {
    const jsonLines = rows.map(row => JSON.stringify(row)).join('\n');
    await writeFile(tempFilePath, jsonLines);
    logger.info(`[BigQuery] Wrote ${rows.length} rows to temporary file: ${tempFilePath}`);

    await bigquery
      .dataset(datasetId)
      .table(tableId)
      .load(tempFilePath, {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_APPEND'
      });
    logger.info(`[BigQuery] Loaded ${rows.length} rows for ${ticker} into BigQuery`);
    rowsInserted = rows.length;
  } catch (bigQueryErr) {
    logger.error(`[BigQuery] Failed to load rows for ${ticker}: ${bigQueryErr.message}`, { error: bigQueryErr, rows });
    throw new Error(`Failed to load into BigQuery: ${bigQueryErr.message}`);
  } finally {
    try {
      await unlink(tempFilePath);
      logger.info(`[BigQuery] Cleaned up temporary file: ${tempFilePath}`);
    } catch (unlinkErr) {
      logger.warn(`[BigQuery] Failed to clean up temporary file: ${unlinkErr.message}`, { error: unlinkErr });
    }
  }

  return rowsInserted;
}

export const fetchTiingo = onCall(
  {
    region: 'us-central1',
    secrets: ['TIINGO_API_KEY']
  },
  async (request) => {
    const { ticker, type } = request.data;
    const apiKey = TIINGO_API_KEY.value();
    if (!apiKey) {
      logger.error('[Tiingo] API key missing from Firebase Secrets');
      throw new Error('Tiingo API key not configured');
    }
    logger.info(`[Tiingo] Runtime key: ✅ Present`);

    if (!ticker || typeof ticker !== 'string') {
      throw new Error('Ticker is required and must be a string.');
    }

    if (type === 'historical') {
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 10);
        const formattedStartDate = startDate.toISOString().split('T')[0];

        logger.info(`[Tiingo] Fetching historical data for ${ticker} from ${formattedStartDate} to ${endDate}`);
        const rowsInserted = await loadDataForTicker(ticker, formattedStartDate, endDate);
        return { success: true, message: `Successfully inserted ${rowsInserted} rows for ${ticker}` };
      } catch (error) {
        logger.error(`[Tiingo] Historical fetch failed for ${ticker}: ${error.message}`, { error });
        throw new Error(`Failed to fetch historical data: ${error.message}`);
      }
    } else {
      const url = `https://api.tiingo.com/tiingo/daily/${ticker}?token=${apiKey}`;
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
          success: true,
          data: {
            ticker: json.ticker,
            name: json.name
          }
        };
      } catch (err) {
        logger.error(`[Tiingo] fetch:error for ${ticker}: ${err.message}`, { error: err });
        throw new Error(`Failed to fetch Tiingo data: ${err.message}`);
      }
    }
  }
);

export const triggerDailyEOD = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GB',
    secrets: ['TIINGO_API_KEY']
  },
  async (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    const firestore = getFirestore();
    const snapshot = await firestore.collection('users/sIAHeA7k0iVy11cnt8Dk7bKMPz12').get();
    const tickers = snapshot.docs.map(doc => doc.id);

    const chunkSize = 50;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const chunkArray = (arr, size) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      );

    const results = [];
    const chunks = chunkArray(tickers, chunkSize);

    for (const [i, chunk] of chunks.entries()) {
      logger.info(`🧠 Starting batch ${i + 1}/${chunks.length} with ${chunk.length} tickers`);

      const batchResults = await Promise.allSettled(
        chunk.map(async ticker => {
          try {
            const rowsInserted = await loadDataForTicker(ticker, date, date);
            logger.info(`✅ ${ticker}: ${rowsInserted} rows inserted`);
            return { ticker, success: true, rowsInserted };
          } catch (err) {
            logger.error(`❌ ${ticker}: ${err.message}`, { error: err });
            return { ticker, success: false, error: err.message };
          }
        })
      );

      results.push(...batchResults.map(r => r.value || r.reason));
      await sleep(60000); // Wait 60s between batches
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.info(`📊 EOD ingest complete: ${successCount} succeeded, ${failureCount} failed`);

    res.status(200).json({
      date,
      total: results.length,
      success: successCount,
      failure: failureCount,
      details: results
    });
  }
);

export const loadHistoricalData = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GB',
    secrets: ['TIINGO_API_KEY']
  },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        logger.info('[loadHistoricalData] Handling OPTIONS request');
        return res.status(204).send('');
      }

      const { ticker } = req.body || {};
      if (!ticker || typeof ticker !== 'string') {
        logger.error('Invalid or missing ticker in request body', { body: req.body });
        return res.status(400).send('Invalid or missing ticker');
      }

      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 10);
        const formattedStartDate = startDate.toISOString().split('T')[0];

        logger.info(`[loadHistoricalData] Starting data load for ${ticker} from ${formattedStartDate} to ${endDate}`);
        const rowsInserted = await loadDataForTicker(ticker, formattedStartDate, endDate);
        logger.info(`[loadHistoricalData] Success for ${ticker}: ${rowsInserted} rows inserted`);
        return res.status(200).send(`Successfully inserted ${rowsInserted} rows for ${ticker}`);
      } catch (error) {
        logger.error(`Error in loadHistoricalData for ${ticker}: ${error.message}`, { error: error });
        return res.status(500).send(`Error: ${error.message}`);
      }
    });
  }
);

export const protectedPage = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Authorization');

    logger.info("🔐 protectedPage triggered");

    const authHeader = req.headers.authorization;
    logger.info(`📡 Authorization header: ${authHeader}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn("🚫 Missing or malformed Authorization header");
      return res.redirect(302, '/index.html');
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      logger.info(`✅ Token verified for UID: ${decoded.uid}`);

      const filePath = path.join(__dirname, 'protected', req.path.replace(/^\//, ''));
      logger.info(`📄 Serving file: ${filePath}`);

      const fileContent = await readFile(filePath, 'utf8');
      res.status(200).set('Content-Type', 'text/html').send(fileContent);
    } catch (error) {
      logger.error(`🚫 Token verification failed: ${error.message}`, { error: error });
      return res.redirect(302, '/index.html');
    }
  }
);
 
