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

// Micro Step 6: Schema validation function for Tiingo data against BigQuery schema
function validateTiingoData(data, ticker, apiUrl) {
  const requiredFields = ['date'];
  const nullableFields = [
    { name: 'open', type: 'number' },
    { name: 'high', type: 'number' },
    { name: 'low', type: 'number' },
    { name: 'close', type: 'number' },
    { name: 'volume', type: 'number' }, // Will check for integer in row mapping
    { name: 'adjClose', type: 'number' }
  ];
  
  for (const item of data) {
    const missingFields = [];
    const invalidFields = [];

    // Check required fields
    for (const field of requiredFields) {
      if (item[field] === undefined || item[field] === null) {
        missingFields.push(field);
      } else if (field === 'date' && typeof item[field] !== 'string') {
        invalidFields.push(`${field} (invalid type: ${typeof item[field]})`);
      } else if (field === 'date') {
        // Validate date format (ISO 8601, e.g., "2023-10-10T00:00:00Z")
        try {
          new Date(item[field]).toISOString();
        } catch {
          invalidFields.push(`${field} (invalid date format)`);
        }
      }
    }

    // Check nullable fields
    for (const field of nullableFields) {
      if (item[field.name] !== undefined && item[field.name] !== null) {
        if (typeof item[field.name] !== field.type) {
          invalidFields.push(`${field.name} (invalid type: ${typeof item[field.name]})`);
        }
        // For volume, ensure it's an integer when present
        if (field.name === 'volume' && typeof item[field.name] === 'number' && !Number.isInteger(item[field.name])) {
          invalidFields.push(`${field.name} (must be integer)`);
        }
      }
    }

    if (missingFields.length > 0 || invalidFields.length > 0) {
      const errorDetails = {
        errorType: 'SchemaValidationError',
        message: `Invalid Tiingo data: ${missingFields.length > 0 ? `missing fields: ${missingFields.join(', ')}` : ''}${missingFields.length > 0 && invalidFields.length > 0 ? '; ' : ''}${invalidFields.length > 0 ? `invalid fields: ${invalidFields.join(', ')}` : ''}`,
        ticker,
        functionName: 'validateTiingoData',
        timestamp: new Date().toISOString(),
        apiUrl,
        missingFields,
        invalidFields
      };
      logger.error(`[Tiingo] Schema validation failed for ${ticker}`, errorDetails);
      throw new Error(errorDetails.message);
    }
  }
}

// Micro Step 7: Check for duplicate data in BigQuery (fixed alias error in UNNEST)
async function checkForDuplicates(ticker, dates, datasetId, tableId) {
  // Simplified query to cast string dates to DATE without alias in UNNEST
  const query = `
    SELECT date
    FROM \`${datasetId}.${tableId}\`
    WHERE ticker_symbol = @ticker AND date IN (
      SELECT PARSE_DATE('%Y-%m-%d', date_string)
      FROM UNNEST(@dates) date_string
    )
  `;
  const options = {
    query,
    params: {
      ticker,
      dates: dates.map(date => date.split('T')[0]) // String array, e.g., ["2023-10-10"]
    }
  };

  try {
    logger.info(`[BigQuery] Checking duplicates for ${ticker} with dates: ${dates.join(', ')}`);
    const [rows] = await bigquery.query(options);
    return rows.map(row => row.date);
  } catch (err) {
    const errorDetails = {
      errorType: 'DuplicateCheckError',
      message: `Failed to check duplicates for ${ticker}: ${err.message}`,
      ticker,
      functionName: 'checkForDuplicates',
      timestamp: new Date().toISOString(),
      datasetId,
      tableId,
      queryParams: { ticker, dates }
    };
    logger.error(`[BigQuery] Duplicate check failed for ${ticker}`, errorDetails);
    throw new Error(errorDetails.message);
  }
}

async function loadDataForTicker(ticker, startDate, endDate) {
  // Micro Step 5: Ensure robust response parsing with structured error logging
  const apiKey = TIINGO_API_KEY.value();
  if (!apiKey) {
    logger.error('[Tiingo] API key missing from Firebase Secrets');
    throw new Error('Tiingo API key not configured');
  }
  logger.info(`[Tiingo] API key presence: ✅ Present`);

  const url = `https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${startDate}&endDate=${endDate}&token=${apiKey}`;
  logger.info(`[Tiingo] Historical fetch URL for ${ticker}: ${url}`);

  let response;
  const maxRetries = 3;
  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10000) }); // 10-second timeout
      if (!response.ok) {
        if (response.status === 429 && retryCount < maxRetries - 1) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          logger.warn(`[Tiingo] Rate limit hit for ${ticker}, retrying after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }
        const errorMessage = `[Tiingo] HTTP error for ${ticker}: ${response.status} ${response.statusText}`;
        logger.error(errorMessage, { status: response.status, statusText: response.statusText });
        throw new Error(errorMessage);
      }
      logger.info(`[Tiingo] Response status for ${ticker}: ${response.status}`);
      break; // Success, exit retry loop
    } catch (fetchErr) {
      const errorMessage = `[Tiingo] Fetch failed for ${ticker}: ${fetchErr.message}`;
      logger.error(errorMessage, { error: fetchErr });
      if (retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        logger.warn(`[Tiingo] Retrying after ${delay}ms for ${ticker}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      throw new Error(errorMessage);
    }
  }

  // Micro Step 5: Parse response body with dedicated error handling and structured logging
  let rawText;
  try {
    rawText = await response.text();
    logger.info(`[Tiingo] Raw response text for ${ticker}: ${rawText.substring(0, 500)}...`); // Limit log size
  } catch (textErr) {
    const errorDetails = {
      errorType: 'ResponseReadError',
      message: textErr.message,
      ticker,
      functionName: 'loadDataForTicker',
      timestamp: new Date().toISOString(),
      apiUrl: url
    };
    logger.error(`[Tiingo] Failed to read response text for ${ticker}`, errorDetails);
    throw new Error('Failed to read Tiingo response body');
  }

  let data;
  try {
    data = JSON.parse(rawText);
    logger.info(`[Tiingo] Parsed JSON for ${ticker}: ${JSON.stringify(data).substring(0, 500)}...`);
  } catch (jsonErr) {
    const errorDetails = {
      errorType: 'JSONParseError',
      message: jsonErr.message,
      ticker,
      functionName: 'loadDataForTicker',
      timestamp: new Date().toISOString(),
      apiUrl: url,
      rawResponse: rawText.substring(0, 500) // Include raw text for debugging
    };
    logger.error(`[Tiingo] JSON parse failed for ${ticker}`, errorDetails);
    throw new Error('Failed to parse Tiingo response');
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No data returned from Tiingo');
  }

  // Micro Step 6: Validate parsed data against full BigQuery schema
  validateTiingoData(data, ticker, url);

  // Micro Step 7: Check for duplicates before mapping rows
  const datasetId = 'swing_trader_data';
  const tableId = 'ticker_history';
  const dates = data.map(item => item.date);
  let nonDuplicateRows = data;

  try {
    const existingDates = await checkForDuplicates(ticker, dates, datasetId, tableId);
    if (existingDates.length > 0) {
      const existingDateSet = new Set(existingDates.map(date => date.split('T')[0]));
      nonDuplicateRows = data.filter(item => !existingDateSet.has(item.date.split('T')[0]));
      const duplicateCount = data.length - nonDuplicateRows.length;
      if (duplicateCount > 0) {
        const warningDetails = {
          errorType: 'DuplicateDataWarning',
          message: `Found ${duplicateCount} duplicate rows for ${ticker}`,
          ticker,
          functionName: 'loadDataForTicker',
          timestamp: new Date().toISOString(),
          duplicateDates: existingDates
        };
        logger.warn(`[BigQuery] Skipped ${duplicateCount} duplicate rows for ${ticker}`, warningDetails);
      }
    }
  } catch (err) {
    throw err; // Rethrow to halt processing if duplicate check fails
  }

  if (nonDuplicateRows.length === 0) {
    logger.info(`[BigQuery] No new rows to insert for ${ticker} after duplicate check`);
    return 0;
  }

  // Map data to BigQuery schema, including ticker_symbol and last_updated
  const rows = nonDuplicateRows.map(item => ({
    ticker_symbol: ticker, // Derived from input ticker
    date: item.date.split('T')[0], // Convert to YYYY-MM-DD
    open: item.open ?? null,
    high: item.high ?? null,
    low: item.low ?? null,
    close: item.close ?? null,
    volume: item.volume ?? null,
    adj_close: item.adjClose ?? null,
    last_updated: new Date().toISOString() // Set to current timestamp
  }));

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
      // Micro Step 5: Parse non-historical response with structured error logging
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          const errorMessage = `[Tiingo] HTTP error for ${ticker}: ${response.status} ${response.statusText}`;
          const errorDetails = {
            errorType: 'HTTPError',
            message: errorMessage,
            ticker,
            functionName: 'fetchTiingo',
            timestamp: new Date().toISOString(),
            apiUrl: url,
            status: response.status,
            statusText: response.statusText
          };
          logger.error(errorMessage, errorDetails);
          throw new Error(errorMessage);
        }
        logger.info(`[Tiingo] Response status for ${ticker}: ${response.status}`);

        let json;
        try {
          json = await response.json();
          logger.info(`[Tiingo] Parsed JSON for ${ticker}: ${JSON.stringify(json).substring(0, 500)}...`);
        } catch (jsonErr) {
          const errorDetails = {
            errorType: 'JSONParseError',
            message: jsonErr.message,
            ticker,
            functionName: 'fetchTiingo',
            timestamp: new Date().toISOString(),
            apiUrl: url
          };
          logger.error(`[Tiingo] JSON parse failed for ${ticker}`, errorDetails);
          throw new Error('Failed to parse Tiingo response');
        }

        if (!json.ticker || !json.name) {
          const errorDetails = {
            errorType: 'MissingFieldsError',
            message: 'Missing expected Tiingo fields',
            ticker,
            functionName: 'fetchTiingo',
            timestamp: new Date().toISOString(),
            apiUrl: url
          };
          logger.error(`[Tiingo] Validation failed for ${ticker}`, errorDetails);
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
        const errorDetails = {
          errorType: 'FetchError',
          message: err.message,
          ticker,
          functionName: 'fetchTiingo',
          timestamp: new Date().toISOString(),
          apiUrl: url
        };
        logger.error(`[Tiingo] fetch:error for ${ticker}`, errorDetails);
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

    // Read tickers directly from the user's watchlist document
    const userDocRef = firestore.doc('users/sIAHeA7k0iVy11cnt8Dk7bKMPz12');
    const userDoc = await userDocRef.get();
    const tickers = (userDoc.exists && Array.isArray(userDoc.data().watchlist))
      ? userDoc.data().watchlist
      : [];

    logger.info(`[EOD] Pulled ${tickers.length} tickers from users/sIAHeA7k0iVy11cnt8Dk7bKMPz12.watchlist`);

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
   

      

  
         

       
   

    

   
