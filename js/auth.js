import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Login with Email
export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Register with Email
export async function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

// Login with Google
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

// Logout
export function logout() {
  return signOut(auth);
}

// Auth state change handler
export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}
