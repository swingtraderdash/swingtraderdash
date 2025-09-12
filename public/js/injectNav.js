import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebaseConfig.js";

const auth = getAuth(app);
let userToken = null;

onAuthStateChanged(auth, user => {
  if (user) {
    user.getIdToken().then(token => {
      userToken = token;
      console.log("🔐 Token cached");
    });
  } else {
    console.warn("🚫 No user signed in");
    userToken = null;
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

      // Add click handler for watchlist link
      const watchlistLink = document.getElementById("watchlist-link");
      if (watchlistLink) {
        watchlistLink.addEventListener("click", async (e) => {
          e.preventDefault();
          if (!userToken) {
            console.warn("🚫 No token, redirecting to /index.html");
            window.location.href = "/index.html";
            return;
          }

          try {
            const response = await fetch("/watchlist.html", {
              headers: {
                Authorization: `Bearer ${userToken}`
              }
            });
            if (response.ok) {
              console.log("✅ Watchlist page accessed");
              window.location.href = "/watchlist.html";
            } else {
              console.warn("🚫 Access denied, redirecting to /index.html");
              window.location.href = "/index.html";
            }
          } catch (error) {
            console.error("🔥 Error accessing watchlist:", error);
            window.location.href = "/index.html";
          }
        });
      }

      console.log("[injectNav] ✅ Nav injected");
    } else {
      console.warn("[injectNav] ⏳ Waiting for #nav to appear...");
    }
  }, 250);
}
