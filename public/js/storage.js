import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { app } from "/js/firebaseConfig.js";

const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);
const fetchTiingo = httpsCallable(functions, "fetchTiingo");

// Just saves the watchlist array—no API calls!
export async function saveWatchlist(tickers) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[storage] 🚫 No user signed in');
      return false;
    }

    const userDoc = doc(db, 'users', user.uid);
    await setDoc(userDoc, { watchlist: tickers }, { merge: true });
    console.log('[storage] ✅ Watchlist saved');
    return true;
  } catch (error) {
    console.error('[storage] 🚫 Failed to save watchlist:', error.message);
    return false;
  }
}

// NEW: Targeted metadata fetch—only for provided tickers, skips if exists
export async function fetchMetadataForTickers(tickersToFetch) {
  if (!tickersToFetch || tickersToFetch.length === 0) {
    console.log('[storage] ℹ️ No new tickers to fetch metadata for');
    return true;
  }

  try {
    for (const ticker of tickersToFetch) {
      console.log(`[storage] 🔍 Checking metadata for ${ticker}`);

      const tickerDocRef = doc(db, 'tickers', ticker);
      const existingSnap = await getDoc(tickerDocRef);
      if (existingSnap.exists()) {
        console.log(`[storage] ✅ Metadata already exists for ${ticker}—skipping API`);
        continue;
      }

      try {
        const result = await fetchTiingo({ ticker });
        const raw = result.data;
        const data = raw.data || raw;

        console.log(`[storage] 📦 Tiingo raw result for ${ticker}:`, data);

        if (!data || !data.ticker || !data.name) {
          throw new Error("Missing expected Tiingo fields");
        }

        await setDoc(tickerDocRef, {
          symbol: data.ticker,
          name: data.name
        }, { merge: true });

        console.log(`[storage] 🧠 Cached new metadata for ${ticker}`);
      } catch (error) {
        console.warn(`[storage] ⚠️ Failed to fetch metadata for ${ticker}:`, error.message);
      }
    }
    return true;
  } catch (error) {
    console.error('[storage] 🚫 Failed to fetch metadata:', error.message);
    return false;
  }
}

// NEW: Targeted historical data fetch—only for provided tickers, skips if exists
export async function fetchHistoricalDataForTickers(tickersToFetch) {
  if (!tickersToFetch || tickersToFetch.length === 0) {
    console.log('[storage] ℹ️ No new tickers to fetch historical data for');
    return [];
  }

  const results = [];
  try {
    for (let i = 0; i < tickersToFetch.length; i++) {
      const ticker = tickersToFetch[i];
      console.log(`[storage] 🔍 Checking historical data for ${ticker}`);

      const tickerDocRef = doc(db, 'historical', ticker);
      const existingSnap = await getDoc(tickerDocRef);
      if (existingSnap.exists()) {
        console.log(`[storage] ✅ Historical data already exists for ${ticker}—skipping API`);
        results.push({ ticker, success: true, message: 'Historical data already loaded' });
        continue;
      }

      try {
        const result = await fetchTiingo({ ticker, type: 'historical' });
        const raw = result.data;
        const data = raw.data || raw;

        console.log(`[storage] 📦 Tiingo historical result for ${ticker}:`, data);

        if (!data || !data.success) {
          throw new Error(data?.error || 'Invalid historical data response');
        }

        await setDoc(tickerDocRef, { fetched: true }, { merge: true });
        console.log(`[storage] 📈 Fetched and cached historical data for ${ticker}`);
        results.push({ ticker, success: true, message: 'Historical data loaded successfully' });
      } catch (error) {
        console.warn(`[storage] ⚠️ Failed to fetch historical data for ${ticker}:`, error.message);
        results.push({ ticker, success: false, error: error.message });
      }

      if (i < tickersToFetch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    return results;
  } catch (error) {
    console.error('[storage] 🚫 Failed to fetch historical data:', error.message);
    return tickersToFetch.map(ticker => ({ ticker, success: false, error: error.message }));
  }
}

// Keep getWatchlist unchanged
export async function getWatchlist() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[storage] 🚫 No user signed in');
      return [];
    }

    const userDoc = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDoc);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.watchlist || [];
    }
    return [];
  } catch (error) {
    console.error('[storage] 🚫 Failed to get watchlist:', error.message);
    return [];
  }
}

     
     
  
