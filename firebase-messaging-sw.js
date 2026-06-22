/* public/firebase-messaging-sw.js — service worker des notifications WildDex */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAX3U4ymn1aAffRjN9gEMO8fslxzIw9Rrc",
  authDomain: "wilddex-b56bf.firebaseapp.com",
  projectId: "wilddex-b56bf",
  storageBucket: "wilddex-b56bf.firebasestorage.app",
  messagingSenderId: "581734015443",
  appId: "1:581734015443:web:02e77365f030d29a5d0f26",
});

const messaging = firebase.messaging();

// Notification reçue quand l'app est fermée ou en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "WildDex 🌿", {
    body: n.body || "Un nouvel animal t'attend !",
    icon: "logo192.png",
    badge: "logo192.png",
  });
});

// Clic sur la notification : ouvre/active l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window" }).then((list) => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow("./");
  }));
});
