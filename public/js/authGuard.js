// public/js/authGuard.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/**
 * Modular page protection for SwingTrader
 * @param {FirebaseApp} app - Firebase app instance
 * @param {string} redirectTo - Path to redirect if user is not authenticated
 */
export function protectPage(app, redirectTo = "/index.html") {
  console.log("🔍 protectPage() invoked — checking auth state...");

  const auth = getAuth(app); // ✅ Pass app explicitly

  // Wait for DOM before applying visibility or redirect
  document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("✅ User is logged in:", user.email);
        document.body.style.visibility = "visible";
      } else {
        console.warn("🚫 User not logged in — redirecting to:", redirectTo);
        window.location.href = redirectTo;
      }
    }, (error) => {
      console.error("🔥 Auth state error:", error);
      window.location.href = redirectTo;
    });
  });
}
