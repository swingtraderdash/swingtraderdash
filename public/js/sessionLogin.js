// /js/sessionLogin.js
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "/js/firebaseConfig.js";

const auth = getAuth(app);

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const idToken = await user.getIdToken(true);

    const response = await fetch("/sessionLogin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idToken })
    });

    if (response.ok) {
      console.log("✅ Session cookie set");
    } else {
      console.error("❌ Failed to set session cookie");
    }
  } catch (error) {
    console.error("🚫 Login failed:", error.message);
  }
});
