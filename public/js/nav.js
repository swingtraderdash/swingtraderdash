// ✅ nav.js — full code with navigation toggle and logout listener

import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ Navigation toggle logic
document.addEventListener("DOMContentLoaded", function () {
  const navLinks = document.querySelectorAll("nav a");

  navLinks.forEach(link => {
    link.addEventListener("click", function () {
      navLinks.forEach(l => l.classList.remove("active"));
      this.classList.add("active");
    });
  });

  // ✅ Logout button listener (runs after nav is injected)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    const auth = getAuth();
    logoutBtn.addEventListener("click", () => {
      signOut(auth)
        .then(() => {
          console.log("👋 User signed out.");
          window.location.href = "index.html";
        })
        .catch((error) => {
          console.error("❌ Logout error:", error.message);
        });
    });
  } else {
    console.warn("⚠️ logout-btn not found after nav injection.");
  }
});
