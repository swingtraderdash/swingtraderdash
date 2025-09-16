import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "/js/firebaseConfig.js";

const db = getFirestore(app);
const auth = getAuth(app);

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

        // Cache metadata for each ticker in sectors collection
        for (const ticker of tickers) {
            console.log(`[storage] 🔍 Checking metadata for ${ticker}`);
            const url = `https://api.tiingo.com/tiingo/daily/${ticker}?token=134b85cc4ea8fe62c59ee2fca25fe5b0033117cf`;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Status ${response.status}`);
                const data = await response.json();

                const sectorDoc = doc(db, 'sectors', ticker);
                await setDoc(sectorDoc, {
                    symbol: data.ticker,
                    name: data.name || "Unknown",
                    sector: data.sector || "Unknown"
                }, { merge: true });

                console.log(`[storage] 🧠 Cached metadata for ${ticker}`);
            } catch (error) {
                console.warn(`[storage] ⚠️ Failed to fetch metadata for ${ticker}:`, error.message);
            }
        }

        return true;
    } catch (error) {
        console.error('[storage] 🚫 Failed to save watchlist:', error.message);
        return false;
    }
}

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
