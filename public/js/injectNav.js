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
        <li><a href="/blanktemplate.html">Blank</a></li>
        <li><a href="/logout.html">Logout</a></li>
      </ul>
    </nav>
  `;
  console.log("[injectNav] Nav HTML injected");

  const watchlistLink = document.getElementById("watchlist-link");
  if (watchlistLink) {
    console.log("[injectNav] Watchlist link found, adding listener");
    watchlistLink.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("[injectNav] Watchlist click detected");
      if (!userToken) {
        console.warn("🚫 No token, redirecting to /index.html");
        window.location.href = "/index.html";
        return;
      }

      console.log("▶️ Fetching /watchlist.html with token...");
      try {
        const response = await fetch("/watchlist.html", {
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        });
        console.log("📡 Fetch response status:", response.status);
        if (response.ok) {
          const content = await response.text();
          console.log("✅ Watchlist content received:", content.substring(0, 100) + "...");
          document.open();
          document.write(content);
          document.close();
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

  console.log("[injectNav] ✅ Nav injected");
}
