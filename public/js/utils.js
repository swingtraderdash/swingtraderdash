import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const db = getFirestore();

export function startDataPolling(renderFunc, pollIntervalMs = 600000) {
  let pollInterval;
  let lastUpdate = parseInt(localStorage.getItem('lastUpdate') || '0');

  async function checkAndRender() {
    try {
      console.log('[poll] Checking for updates...');
      const lastUpdateDoc = await getDoc(doc(db, 'system', 'lastUpdate'));
      const serverUpdate = lastUpdateDoc.exists() ? lastUpdateDoc.data().timestamp : 0;
      if (serverUpdate > lastUpdate) {
        console.log('[poll] New data detected—refreshing');
        localStorage.setItem('lastUpdate', serverUpdate.toString());
        await renderFunc();
      } else {
        console.log('[poll] No new data');
      }
    } catch (error) {
      console.error('[poll] Error:', error);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndRender();
      pollInterval = setInterval(checkAndRender, pollIntervalMs);
    } else {
      if (pollInterval) clearInterval(pollInterval);
    }
  });

  checkAndRender();
}
