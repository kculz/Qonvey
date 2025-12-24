// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyClAyYM8uSkuaGNo0AO4FPnLt2ZnUZSOqw",
  authDomain: "qonvey-f5587.firebaseapp.com",
  projectId: "qonvey-f5587",
  storageBucket: "qonvey-f5587.firebasestorage.app",
  messagingSenderId: "238113616660",
  appId: "1:238113616660:web:07825ba09dc09907b08801",
  measurementId: "G-LCCQWN83N4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);