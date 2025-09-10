import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "/js/firebaseConfig.js";

const auth = getAuth(app);

document.getElementById("loginBtn").addEventListener("click", async () => {
  console.log('[sessionLogin] Starting login');
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

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
      console.log('[sessionLogin] ✅ Session cookie set');
    } else {
      console.error('[sessionLogin] ❌ Failed to set session cookie:', response.status, response.statusText, responseBody);
    }
  } catch (error) {
    console.error('[sessionLogin] 🚫 Login failed:', error.message);
  }
});
