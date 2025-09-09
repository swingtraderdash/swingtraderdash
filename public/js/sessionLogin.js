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
    console.log("[sessionLogin] 🔍 Sending idToken:", idToken.substring(0, 20) + '...');

    const requestBody = JSON.stringify({ idToken });
    console.log("[sessionLogin] 📤 Request body:", requestBody);

    const response = await fetch("https://us-central1-swingtraderdash-1a958.cloudfunctions.net/sessionLogin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: requestBody,
      credentials: "include"
    });

    if (response.ok) {
      console.log("✅ Session cookie set");
    } else {
      console.error("❌ Failed to set session cookie:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("🚫 Login failed:", error.message);
  }
});
