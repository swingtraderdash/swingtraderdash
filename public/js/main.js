// File: /public/js/main.js

console.log("🛠️ [STEP 1] main.js loaded");

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { app } from "./firebaseConfig.js";
console.log("🔌 Imported Firebase app instance:", app);

// Firebase Auth instance
const auth = getAuth(app);
console.log("✅ Firebase initialized — auth instance:", auth);

// DOM elements
const loginBox      = document.querySelector(".login-box");
const loginBtn      = document.getElementById("loginBtn");
const emailInput    = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

// Log currentUser immediately
console.log("ℹ️ auth.currentUser before listener:", auth.currentUser);

// Auth state listener (with extra callbacks)
console.log("🔍 [STEP 2] about to attach auth listener with auth:", auth);
onAuthStateChanged(
  auth,
  (user) => {
    console.log("🔍 [STEP 3] onAuthStateChanged callback — user is:", user);
    if (user) {
      console.log("👤 Authenticated as:", user.email);
      loginBox && (loginBox.style.display = "none");
      injectNav();
    } else {
      console.log("👤 No user authenticated");
      loginBox && (loginBox.style.display = "block");
    }
  },
  (error) => {
    console.error("❌ onAuthStateChanged error:", error);
  },
  () => {
    console.log("✅ onAuthStateChanged listener subscribed and ready");
  }
);

// schedule a delayed log to see if currentUser changes
setTimeout(() => {
  console.log("⏲️ [DELAYED] auth.currentUser after 2s:", auth.currentUser);
}, 2000);

// Login handler
loginBtn?.addEventListener("click", async () => {
  console.log("🛠️ [STEP 4] loginBtn clicked");
  const email    = emailInput.value;
  const password = passwordInput.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login successful:", userCredential.user.email);
  } catch (error) {
    console.error("❌ Login failed:", error.message);
    alert("Login failed: " + error.message);
  }
});

// Nav injection logic
function injectNav() {
  console.log("[injectNav] Fired");
  const waitForNav = setInterval(() => {
    const navContainer = document.getElementById("nav");
    if (navContainer) {
      clearInterval(waitForNav);
      navContainer.innerHTML = `
        <nav>
          <ul>
            <li><a href="/index.html">Home</a></li>
            <li class="dropdown">
              <a href="#">Alerts</a>
              <ul class="dropdown-content">
                <li><a href="/set-new.html">Set New</a></li>
                <li><a href="/manage.html">Manage</a></li>
                <li><a href="/triggeredalerts.html">Triggered</a></li>
              </ul>
            </li>
            <li><a href="/watchlist.html">Watchlist</a></li>
            <li><a href="/logout.html">Logout</a></li>
          </ul>
        </nav>
      `;
      console.log("[injectNav] ✅ Nav injected");
    } else {
      console.warn("[injectNav] ⏳ Waiting for #nav to appear...");
    }
  }, 250);
}
