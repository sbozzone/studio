
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: Replace these with your actual Firebase project's configuration
// and ensure they are in a .env.local file for security.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_FALLBACK_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_FALLBACK_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_FALLBACK_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_FALLBACK_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_FALLBACK_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_FALLBACK_APP_ID"
};

// Check if Firebase is using fallback configuration values
const isFallbackConfig =
  firebaseConfig.apiKey === "YOUR_FALLBACK_API_KEY" ||
  firebaseConfig.authDomain === "YOUR_FALLBACK_AUTH_DOMAIN" ||
  firebaseConfig.projectId === "YOUR_FALLBACK_PROJECT_ID" ||
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY; // Check if the env var itself is missing

if (isFallbackConfig) {
  console.error(
    "***************************************************************************************************\n" +
    "FIREBASE CONFIGURATION WARNING:\n" +
    "Firebase is attempting to initialize with placeholder or missing configuration values.\n" +
    "This can lead to errors if you use Firebase services.\n\n" +
    "Please ensure you have a .env.local file in the root of your project with your\n" +
    "actual Firebase project's credentials, prefixed with NEXT_PUBLIC_.\n\n" +
    "Example .env.local content:\n" +
    "NEXT_PUBLIC_FIREBASE_API_KEY=\"your-actual-api-key\"\n" +
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=\"your-actual-auth-domain\"\n" +
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID=\"your-actual-project-id\"\n" +
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=\"your-actual-storage-bucket\"\n" +
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=\"your-actual-messaging-sender-id\"\n" +
    "NEXT_PUBLIC_FIREBASE_APP_ID=\"your-actual-app-id\"\n\n" +
    "After creating or updating .env.local, you MUST restart your Next.js development server.\n" +
    "***************************************************************************************************"
  );
}

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export default app;
