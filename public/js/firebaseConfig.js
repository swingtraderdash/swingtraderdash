console.log("[firebaseConfig.js] ✅ Loaded");

// File: /public/js/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIUbM6ZSPGDh9AxU2ySN4Ldtzpka5RpCg",
  authDomain: "swingtraderdash-1a958.firebaseapp.com",
  projectId: "swingtraderdash-1a958",
  storageBucket: "swingtraderdash-1a958.firebasestorage.app",
  messagingSenderId: "27892139023",
  appId: "1:27892139023:web:10f0679e33eb93b3744f7a"
};

export const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("[Firebase] 🧠 Session persistence set to local"))
  .catch((err) => console.error("[Firebase] ❌ Failed to set persistence:", err));

// ✅ Expose auth globally for console debugging
window.auth = auth;

