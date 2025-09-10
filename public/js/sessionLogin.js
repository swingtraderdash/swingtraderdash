import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "/js/firebaseConfig.js";

const auth = getAuth(app);

console.log('[sessionLogin] Script loaded');

const loginBtn = document.getElementById("loginBtn");
if (!loginBtn) {
  console.error('[sessionLogin] 🚫 Login button not found');
} else {
  console.log('[sessionLogin] ✅ Login button found');
}

loginBtn.addEventListener("click", async () => {
  console.log('[sessionLogin] 🔄 Login button clicked');
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  if (!email || !password) {
    console.error('[sessionLogin] 🚫 Email or password missing', { email, password });
    return;
  }

  try {
    console.log('[sessionLogin] ▶️ Attempting sign-in with:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('[sessionLogin] ✅ Firebase auth successful:', user.email);

    const idToken = await user.getIdToken(true);
    console.log('[sessionLogin] 🔍 Sending idToken to https://sessionlogin-mtxejoobqq-uc.a.run.app');

    const response = await fetch("https://sessionlogin-mtxejoobqq-uc.a.run.app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ idToken }),
      credentials: "include"
    });

    const responseBody = await response.json();
    console.log('[sessionLogin] Response:', response.status, responseBody);

    if (response.ok) {
      console.log('[sessionLogin] ✅ Authentication verified');
    } else {
      console.error('[sessionLogin] ❌ Authentication failed:', response.status, response.statusText, responseBody);
    }
  } catch (error) {
    console.error('[sessionLogin] 🚫 Login failed:', error.message, error.code);
  }
});
