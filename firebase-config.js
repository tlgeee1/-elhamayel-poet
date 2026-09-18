// ============================================================
// إعدادات Firebase — لازم تستبدل القيم دي ببيانات مشروعك
// اتبع الخطوات في README.md عشان تجيب البيانات دي
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBUjccgx9UpaeKnqcX-one0eA785AFPe2k",
  authDomain: "elhamayel-poet.firebaseapp.com",
  projectId: "elhamayel-poet",
  storageBucket: "elhamayel-poet.firebasestorage.app",
  messagingSenderId: "580829125881",
  appId: "1:580829125881:web:b3e678b2363b953517d628",
  measurementId: "G-0JJPN2RW9F"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
