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

        if (trialLink) {
          clearInterval(waitForTrialLink);

          trialLink.addEventListener("click", async (e) => {
            e.preventDefault();

            if (userToken) {
              console.log("🔐 Navigating to Trial page via browser");
              try {
                // Call /sessionLogin to validate the token
                const response = await fetch('https://us-central1-swingtraderdash-1a958.cloudfunctions.net/sessionLogin', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`,
                  },
                  body: JSON.stringify({ idToken: userToken }),
                  credentials: 'include', // Include session cookie if needed
                });

                if (response.ok) {
                  console.log("✅ Session validated, navigating to Trial page");
                  window.location.assign("/trialpage");
                } else {
                  console.error("🚫 Session validation failed:", response.status, response.statusText);
                  window.location.assign("/access-denied"); // Redirect to access denied page
                }
              } catch (error) {
                console.error("🚫 Error during session validation:", error);
                window.location.assign("/access-denied");
              }
            } else {
              console.warn("🚫 No token available — user may not be signed in");
              window.location.assign("/access-denied");
            }
          });

          console.log("[injectNav] 🔐 Trial link secured");
        } else {
          console.warn("[injectNav] ⏳ Waiting for Trial link...");
        }
      }, 250);
    } else {
      console.warn("[injectNav] ⏳ Waiting for #nav to appear...");
    }
  }, 250);
}
