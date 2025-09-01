// 🔧 injex.js — Login Logic for SwingTrader
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js"; // Make sure firebaseConfig.js exports your initialized app

const auth = getAuth(app);

// ✅ Console-confirmed Firebase init
console.log("[Firebase] ✅ Initialized");

// 🔐 Login Button Listener
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");

  if (!loginBtn) {
    console.error("[Login] ❌ loginBtn not found");
    return;
  }

  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;

    if (!email || !password) {
      console.warn("[Login] ⚠️ Missing email or password");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("[Login] ✅ Success", userCredential.user);
      // Optional: redirect or show dashboard
    } catch (error) {
      console.error("[Login] ❌ Failed", error.code, error.message);
    }
  });
});
