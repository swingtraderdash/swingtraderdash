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
