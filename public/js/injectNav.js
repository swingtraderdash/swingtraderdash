import { getAuth, onAuthStateChanged, getIdToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js";

const auth = getAuth(app);
let userToken = null;

onAuthStateChanged(auth, user => {
  if (user) {
    console.log("🔐 User authenticated, fetching token...");
    getIdToken(user).then(token => {
      userToken = token;
      console.log("🔐 Token cached:", token ? "Yes" : "No");
    }).catch(error => {
      console.error("🔥 Token fetch error:", error);
    });
  } else {
    console.warn("🚫 No user signed in");
    userToken = null;
  }
});

export function injectNav() {
  console.log("[injectNav] Fired");
  const navContainer = document.getElementById("nav");

  if (!navContainer) {
    console.error("[injectNav] 🚫 #nav container not found");
    return;
  }

  navContainer.innerHTML = `
    <nav>
      <ul>
        <li><a href="/index.html">Home</a></li> 
        <li><a href="#" id="watchlist-link">Watchlist</a></li>
        <li class="dropdown">
          <a href="#">Alerts</a>
          <ul class="dropdown-content">
            <li><a href="/set-new.html">Set New</a></li>
            <li><a href="/manage.html">Manage</a></li>
            <li><a href="/triggeredalerts.html">Triggered</a></li>
          </ul>
        </li>              
        <li><a href="/logout.html">Logout</a></li>
      </ul>
    </nav>
  `;
  console.log("[injectNav] Nav HTML injected");
}

// Handle watchlist link click
const watchlistLink = document.getElementById("watchlist-link");
if (watchlistLink) {
  console.log("[injectNav] Watchlist link found, adding listener");
  watchlistLink.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("[injectNav] Watchlist click detected at:", Date.now());
    if (!userToken) {
      console.warn("🚫 No token, redirecting to /index.html");
      window.location.href = "/index.html";
      return;
    }

    console.log("▶️ Fetching /watchlist.html with token...");
    try {
      const startTime = Date.now();
      const response = await fetch("/watchlist.html", {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      });
      const endTime = Date.now();
      console.log(`📡 Fetch response status: ${response.status}, took ${endTime - startTime}ms`);
      if (response.ok) {
        console.log("✅ Watchlist content received");
        document.open();
        document.write(await response.text());
        document.close();
        // Re-inject nav bar after content load
        setTimeout(() => {
          console.log("[injectNav] Re-injecting nav after watchlist load");
          injectNav();
        }, 0);
      } else {
        console.warn("🚫 Access denied, status:", response.status);
        window.location.href = "/index.html";
      }
    } catch (error) {
      console.error("🔥 Error accessing watchlist:", error);
      window.location.href = "/index.html";
    }
  });
} else {
  console.error("[injectNav] 🚫 Watchlist link not found");
}

console.log("[injectNav] ✅ Initial nav setup complete");
