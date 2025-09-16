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
  console.log("[injectNav] Fired at:", Date.now());
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
            <li><a href="#" id="set-new-link">Set New</a></li>
            <li><a href="#" id="manage-link">Manage</a></li>
            <li><a href="#" id="triggeredalerts-link">Triggered</a></li>
          </ul>
        </li> 
        <li><a href="#" id="news-link">News</a></li>
        <li class="dropdown">
          <a href="#">API</a>
          <ul class="dropdown-content">
            <li><a href="#" id="history-link">API</a></li>
             </ul> 
             </li>
         <li><a href="/logout.html">Logout</a></li>
      </ul>
    </nav>
    <style>
      .dropdown-content {
        background-color: white;
        box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        border: 1px solid #ddd;
        border-radius: 4px;
        z-index: 1000;
        min-width: 160px;
        padding: 8px 0;
      }
      .dropdown-content li a {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
      }
      .dropdown-content li a:hover {
        background-color: #f1f1f1;
        color: blue;
      }
    </style>
  `;
  console.log("[injectNav] Nav HTML and styles injected at:", Date.now());

  // Define protected pages
  const protectedLinks = [
    { id: "watchlist-link", path: "/watchlist.html" },
    { id: "set-new-link", path: "/set-new.html" },
    { id: "manage-link", path: "/manage.html" },
    { id: "triggeredalerts-link", path: "/triggeredalerts.html" },
    { id: "history-link", path: "/history.html" },
    { id: "news-link", path: "/news.html" }
  ];

  // Attach listeners for protected pages
  protectedLinks.forEach(link => {
    const element = document.getElementById(link.id);
    if (element) {
      console.log(`[injectNav] ${link.id} found, adding listener at:`, Date.now());
      element.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log(`[injectNav] ${link.id} click detected, fetching ${link.path} at:`, Date.now());
        if (!userToken) {
          console.warn("🚫 No token, redirecting to /index.html");
          window.location.href = "/index.html";
          return;
        }

        console.log(`▶️ Fetching ${link.path} with token...`);
        try {
          const startTime = Date.now();
          const response = await fetch(link.path, {
            headers: {
              Authorization: `Bearer ${userToken}`
            }
          });
          const endTime = Date.now();
          console.log(`📡 Fetch response status for ${link.path}: ${response.status}, took ${endTime - startTime}ms`);
          if (response.ok) {
            const text = await response.text();
            console.log(`✅ ${link.path} content received:`, text.substring(0, 100) + "...");
            document.open();
            document.write(text);
            document.close();
            console.log(`[injectNav] Re-injecting nav after ${link.path} load at:`, Date.now());
            injectNav();
          } else {
            console.warn(`🚫 Access denied for ${link.path}, status: ${response.status}, text:`, await response.text());
            window.location.href = "/index.html";
          }
        } catch (error) {
          console.error(`🔥 Error accessing ${link.path}:`, error.message);
          window.location.href = "/index.html";
        }
      });
    } else {
      console.error(`[injectNav] 🚫 ${link.id} not found after injection`);
    }
  });

  console.log("[injectNav] ✅ Nav injected at:", Date.now());
}
    
