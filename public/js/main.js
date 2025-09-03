// File: /public/js/main.js

import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js";
import { injectNav } from "./injectNav.js"; // ✅ Modular nav injection

document.addEventListener("DOMContentLoaded", () => {
  console.log("[main.js] DOM fully loaded");

  const auth = getAuth(app);
  console.log("✅ Firebase initialized");

  const loginBox = document.querySelector(".login-box");
  const loginBtn = document.getElementById("loginBtn");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");

  loginBtn?.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Login successful:", userCredential.user.email);
      document.cookie = "auth=true; path=/";
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      alert("Login failed: " + error.message);
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("👤 Authenticated as:", user.email);
      if (loginBox) loginBox.style.display = "none";

      // ✅ Inject secure nav bar
      injectNav();
    } else {
      console.log("👤 No user authenticated");
      if (loginBox) loginBox.style.display = "block";
    }
  });
});
