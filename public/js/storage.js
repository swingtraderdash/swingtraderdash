import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "/js/firebaseConfig.js";

const db = getFirestore(app);
const auth = getAuth(app);

// ✅ Replaces legacy Firebase Function with direct Cloud Run call
async function fetchTiingo({ ticker }) {
  const response = await fetch('https://fetchtiingo-mtxejoobqq-uc.a.run.app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker })
  });
  return await response.json();
}

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

      // First, check if already exists in Firestore
      const tickerDocRef = doc(db, 'tickers', ticker);
      const existingSnap = await getDoc(tickerDocRef);
      if (existingSnap.exists()) {
        console.log(`[storage] ✅ Metadata already exists for ${ticker}—skipping API`);
        continue;
      }

      // Only fetch if missing
      try {
        const data = await fetchTiingo({ ticker });

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
