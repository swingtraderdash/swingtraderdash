// File: /public/js/main.js

import { initFirebase } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { injectNav } from "./injectNav.js";

console.log("🔌 [STEP 1] main.js loaded");

(async function bootstrap() {
  // STEP 2: initialize Firebase and await persistence
  const { auth } = await initFirebase();
  console.log("🔍 [STEP 2] Attaching onAuthStateChanged listener with auth:", auth);

  // STEP 3: react to auth state changes
  onAuthStateChanged(auth, (user) => {
    console.log("🔍 [STEP 3] onAuthStateChanged callback — user is:", user);
    if (user) {
      console.log("👤 Authenticated as:", user.email);
      injectNav(user.uid);
    } else {
      console.log("👤 No user authenticated");
      injectNav(null);
    }
  });

  // STEP 4: wire up your login button
  document
    .getElementById("loginBtn")
    .addEventListener("click", async () => {
      console.log("🛠️ [STEP 4] loginBtn clicked");
      const email = document.getElementById("emailInput").value;
      const password = document.getElementById("passwordInput").value;

      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login successful:", cred.user.email);
      } catch (err) {
        console.error("❌ Login error:", err);
      }
    });
})();
