export function injectUserGreeting(uid) {
  const target = document.getElementById("user-greeting");
  if (target) {
    target.innerText = `Welcome, trader ${uid}`;
    console.log(`[SwingTrader] ✅ Greeting injected for UID: ${uid}`);
    document.body.style.visibility = "visible";
  } else {
    console.warn("[SwingTrader] ⚠️ No target found for user greeting.");
  }
}
