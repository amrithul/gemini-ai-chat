
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// TODO: Replace with your own Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDETQuodIVfvDFH2JDNXEZw78Mcr20JmKg",
  authDomain: "chatbotnew-4b3e6.firebaseapp.com",
  projectId: "chatbotnew-4b3e6",
  storageBucket: "chatbotnew-4b3e6.firebasestorage.app",
  messagingSenderId: "167849276559",
  appId: "1:167849276559:web:eaf76936f6c3f1316bacfa",
  measurementId: "G-GQWPXRXLJY"
};

// Initialize Firebase and export the auth instance.
const app = firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
