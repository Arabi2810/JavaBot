import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, updateProfile } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkygib55YGu1iD8w7xxplvVMWZw6qJXqE",
  authDomain: "javabot-498821.firebaseapp.com",
  projectId: "javabot-498821",
  storageBucket: "javabot-498821.firebasestorage.app",
  messagingSenderId: "295149856823",
  appId: "1:295149856823:web:aecf8649bfa693e38d37b2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── Auth functions ──────────────────────────────

window.fbSignUp = async (name, email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), { name, email, createdAt: serverTimestamp() });
  return cred.user;
};

window.fbSignIn = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

window.fbGoogleSignIn = async () => {
  const cred = await signInWithPopup(auth, googleProvider);
  const ref = doc(db, 'users', cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name: cred.user.displayName,
      email: cred.user.email,
      createdAt: serverTimestamp()
    });
  }
  return cred.user;
};

window.fbSignOut = () => signOut(auth);

window.fbOnAuthChanged = (callback) => onAuthStateChanged(auth, callback);

// ── Firestore chat functions ────────────────────

window.fbSaveChat = async (uid, chat) => {
  await setDoc(doc(db, 'users', uid, 'chats', chat.id), {
    id: chat.id,
    title: chat.title,
    messages: chat.messages,
    createdAt: chat.createdAt || serverTimestamp()
  });
};

window.fbLoadChats = async (uid) => {
  const q = query(collection(db, 'users', uid, 'chats'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
};

window.fbDeleteChat = async (uid, chatId) => {
  await deleteDoc(doc(db, 'users', uid, 'chats', chatId));
};