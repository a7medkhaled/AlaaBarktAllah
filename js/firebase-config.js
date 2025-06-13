// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Replace the below config with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBiuIS2-tmFhIsMyzpk6W-PvU5os0ukfVs",
  authDomain: "alaabarktallah.firebaseapp.com",
  projectId: "alaabarktallah",
  storageBucket: "alaabarktallah.firebasestorage.app",
  messagingSenderId: "893572008389",
  appId: "1:893572008389:web:51c2b9586e8073c83223ac",
  measurementId: "G-1WQCKRXCYB",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
