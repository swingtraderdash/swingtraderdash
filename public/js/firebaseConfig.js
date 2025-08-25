// File: /public/js/firebaseConfig.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIUbM6ZSPGDh9AxU2ySN4Ldtzpka5RpCg",
  authDomain: "swingtraderdash-1a958.firebaseapp.com",
  projectId: "swingtraderdash-1a958",
  storageBucket: "swingtraderdash-1a958.firebasestorage.app",
  messagingSenderId: "27892139023",
  appId: "1:27892139023:web:10f0679e33eb93b3744f7a"
};

export async function initFirebase() {
  // initialize the app
  const app = initializeApp(firebaseConfig);

  // initialize auth and await persistence
  const auth = getAuth(app);
  console.log("🔧 [INIT] Setting auth persistence to local");
  await setPersistence(auth, browserLocalPersistence);
  console.log("✅ [INIT] Persistence set to local");

  return { app, auth };
}

