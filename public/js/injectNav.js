import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "/js/firebaseConfig.js";

const auth = getAuth(app);

console.log('[injectNav] Script loaded');

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('[injectNav] ✅ User signed in:', user.email);
  } else {
    console.log('[injectNav] 🚫 No user signed in');
  }

  const navDiv = document.getElementById('nav');
  if (!navDiv) {
    console.error('[injectNav] 🚫 Nav div not found');
    return;
  }

  const navContent = `
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        ${user ? '<li><a href="#" id="logoutBtn">Logout</a></li>' : ''}
      </ul>
    </nav>
  `;
  navDiv.innerHTML = navContent;
  console.log('[injectNav] ✅ Nav injected');

  if (user) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await auth.signOut();
          console.log('[injectNav] ✅ User signed out');
          window.location.href = '/';
        } catch (error) {
          console.error('[injectNav] 🚫 Logout failed:', error.message);
        }
      });
    }
  }
});
