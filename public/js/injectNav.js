// File: /public/js/injectNav.js

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js";

const auth = getAuth(app);
let userToken = null;

// 🔄 Listen for auth state and cache token
onAuthStateChanged(auth, user => {
  if (user) {
    user.getIdToken().then(token => {
      userToken = token;
      console.log("🔐 Token cached");
    });
  } else {
    console.warn("🚫 No user signed in");
  }
});

export function injectNav() {
  console.log("[injectNav] Fired");

  const waitForNav = setInterval(() => {
    const navContainer = document.getElementById("nav");

    if (navContainer) {
      clearInterval(waitForNav);

      navContainer.innerHTML = `
        <nav>
          <ul>
            <li><a href="/index.html">Home</a></li> 
            <li><a href="/watchlist.html">Watchlist</a></li>
            <li><a href="/trialpage.html" id="trialLink">Trial</a></li>
            <li class="dropdown">
              <a href="#">Alerts</a>
              <ul class="dropdown-content">
                <li><a href="/set-new.html">Set New</a></li>
                <li><a href="/manage.html">Manage</a></li>
                <li><a href="/triggeredalerts.html">Triggered</a></li>
              </ul>
            </li>              
            <li><a href="/blanktemplate.html">Blank</a></li>
            <li><a href="/logout.html">Logout</a></li>
          </ul>
        </nav>
      `;
      console.log("[injectNav] ✅ Nav injected");

      // Secure Trial link handler
      const waitForTrialLink = setInterval(() => {
        const trialLink = document.getElementById("trialLink");
        const mainContent = document.getElementById("mainContent"); // Adjust if needed

        if (trialLink && mainContent) {
          clearInterval(waitForTrialLink);

          trialLink.addEventListener("click", (e) => {
            e.preventDefault();

            if (userToken) {
              fetch("/trialpage", {
                method: "GET",
                credentials: "include"
              })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`403 Forbidden — session cookie may be missing`);
                }
                return response.text();
              })
              .then(html => {
                console.log("✅ Trial page loaded");
                mainContent.innerHTML = html;
              })
              .catch(error => {
                console.error("❌ Error loading trial page:", error.message);
              });
            } else {
              console.warn("🚫 No token available — user may not be signed in");
            }
          });

          console.log("[injectNav] 🔐 Trial link secured");
        } else {
          console.warn("[injectNav] ⏳ Waiting for Trial link or #mainContent...");
        }
      }, 250);
    } else {
      console.warn("[injectNav] ⏳ Waiting for #nav to appear...");
    }
  }, 250);
}
