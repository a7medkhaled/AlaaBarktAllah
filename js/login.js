// js/login.js
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  logout,
  onAuthChange,
} from "./auth.js";
import { auth } from "./firebase-config.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const userInfo = document.getElementById("user-info");

document.getElementById("login-email").addEventListener("click", async () => {
  try {
    const userCred = await loginWithEmail(
      emailInput.value,
      passwordInput.value
    );
    console.log("Logged in:", userCred.user);
  } catch (e) {
    alert(e.message);
  }
});

// document
//   .getElementById("register-email")
//   .addEventListener("click", async () => {
//     try {
//       const userCred = await registerWithEmail(
//         emailInput.value,
//         passwordInput.value
//       );
//       console.log("Registered:", userCred.user);
//     } catch (e) {
//       alert(e.message);
//     }
//   });

// document.getElementById("login-google").addEventListener("click", async () => {
//   try {
//     const result = await loginWithGoogle();
//     console.log("Google signed in:", result.user);
//   } catch (e) {
//     alert(e.message);
//   }
// });

// document.getElementById("logout").addEventListener("click", async () => {
//   await logout();
//   window.location.href = "/login.html"; // go back to login
// });

const redirectTo = "/index.html"; // after successful login
const loginForm = document.getElementById("loginForm");
const globalLoader = document.getElementById("global-loader");

onAuthChange((user) => {
  if (user) {
    window.location.href = redirectTo;
  } else {
    loginForm.style = "block";
    globalLoader.style = "none";
  }
});
if (!auth.currentUser) {
  document.getElementById("logout").style.display = "none";
}
