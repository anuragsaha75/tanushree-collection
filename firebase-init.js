const firebaseConfig = {
  apiKey: "AIzaSyCTGz2SrBcuNWD2yJkXpOfJ36pPbAYM9eI",
  authDomain: "tanushree-collections.firebaseapp.com",
  projectId: "tanushree-collections",
  storageBucket: "tanushree-collections.appspot.com",
  messagingSenderId: "664336965557",
  appId: "1:664336965557:web:2bb2ee5b7eaed842ba43fc",
  measurementId: "G-6J1SNSKS3X"
};

// Initialize Firebase
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ✅ INIT IMMEDIATELY (CRITICAL FIX)
window.auth = firebase.auth();
window.db = firebase.firestore();
window.firebase = firebase;

if (typeof firebase.storage === "function") {
  window.storage = firebase.storage();
}

// ✅ DEBUG
console.log("Firebase Loaded:", window.auth, window.db);

// ✅ WAIT FUNCTION
function waitForFirebase(callback) {
  if (window.auth && window.db) {
    console.log("✅ Firebase Ready");
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 50);
  }
}