// File: /public/js/main.js

import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js";

// Firebase Auth instance
const auth = getAuth(app);
console.log("✅ Firebase initialized");

// DOM elements
const loginBox = document.querySelector(".login-box");
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

// Login handler
loginBtn?.addEventListener("click", async () => {
  const email = emailInput.value;
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
        <nav class="main-nav">
          <ul>
            <li><a href="/index.html">Home</a></li>
            <li><a href="/logout.html">Logout</a></li>
          </ul>
        </nav>
      `;

      console.log("[injectNav] ✅ Nav injected");
    } else {
      console.warn("[injectNav] ⏳ Waiting for #nav to appear...");
    }
  }, 250); // Check every 250ms
}

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("👤 Authenticated as:", user.email);

    // Hide login box
    if (loginBox) loginBox.style.display = "none";

    // Inject nav bar
    injectNav();
  } else {
    console.log("👤 No user authenticated");
    if (loginBox) loginBox.style.display = "block";
  }
});
