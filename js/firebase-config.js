// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { isDev } from "../settings.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const ENV = isDev ? "dev" : "prod";
const configFile = `./firebaseKeys.${ENV}.json`;
const response = await fetch(configFile);
const firebaseConfig = await response.json();
console.log(firebaseConfig);

// Replace the below config with your actual Firebase project config
// const firebaseConfig = {
//   apiKey: "AIzaSyBiuIS2-tmFhIsMyzpk6W-PvU5os0ukfVs",
//   authDomain: "alaabarktallah.firebaseapp.com",
//   projectId: "alaabarktallah",
//   storageBucket: "alaabarktallah.firebasestorage.app",
//   messagingSenderId: "893572008389",
//   appId: "1:893572008389:web:51c2b9586e8073c83223ac",
//   measurementId: "G-1WQCKRXCYB",
// };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
