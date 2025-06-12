// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBiuIS2-tmFhIsMyzpk6W-PvU5os0ukfVs",
  authDomain: "alaabarktallah.firebaseapp.com",
  projectId: "alaabarktallah",
  storageBucket: "alaabarktallah.firebasestorage.app",
  messagingSenderId: "893572008389",
  appId: "1:893572008389:web:51c2b9586e8073c83223ac",
  measurementId: "G-1WQCKRXCYB",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
