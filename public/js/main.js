import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js";
import { injectNav } from "./injectNav.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[main.js] DOM fully loaded");

  const auth = getAuth(app);
  console.log("✅ Firebase initialized");

  const loginBox = document.querySelector(".login-box");
  const loginBtn = document.getElementById("loginBtn");

  // ✅ Listen for login button click
  if (loginBtn) {
    let isSigningIn = false; // Prevent multiple sign-in attempts
    loginBtn.addEventListener("click", async () => {
      if (isSigningIn) {
        console.log("⏳ Sign-in already in progress, please wait");
        return;
      }
      isSigningIn = true;
      loginBtn.disabled = true; // Disable button during sign-in
      const email = document.getElementById("emailInput").value;
      const password = document.getElementById("passwordInput").value;

      console.log("▶️ Attempting sign-in with:", email);

      try {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Signed in:", user.email);
      } catch (err) {
        console.error("❌ Sign-in failed:", err.message);
      } finally {
        isSigningIn = false;
        loginBtn.disabled = false; // Re-enable button
      }
    });
  }

  // ✅ Monitor auth state with delay
  onAuthStateChanged(auth, (user) => {
    setTimeout(() => {
      if (user) {
        console.log("👤 Authenticated as:", user.email);
        if (loginBox) loginBox.style.display = "none";
        // Show page content for authenticated users
        document.body.style.visibility = "visible";
        // ✅ Inject secure nav bar
        injectNav();
        // Trigger page-specific rendering
        if (window.location.pathname.includes("watchlist.html")) {
          console.log("[auth] User authenticated—triggering watchlist render");
          window.dispatchEvent(new CustomEvent('authReady'));
        }
      } else {
        console.log("👤 No user authenticated");
        if (loginBox) loginBox.style.display = "block";
        // Hide page content and redirect for protected pages
        if (window.location.pathname.includes("watchlist.html")) {
          console.log("🚫 User not logged in—redirecting to /index.html");
          window.location.href = "/index.html";
        } else {
          document.body.style.visibility = "visible";
        }
      }
    }, 500); // 500ms delay to ensure auth state resolves
  }, (error) => {
    console.error("🔥 Auth state error:", error);
    setTimeout(() => {
      if (window.location.pathname.includes("watchlist.html")) {
        console.log("🚫 Auth error—redirecting to /index.html");
        window.location.href = "/index.html";
      }
    }, 500);
  });
});
    
