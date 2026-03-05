/* ============================================
   PRISMA - Configuracao do Firebase

   INSTRUCOES: Substitua os valores abaixo
   pelos dados do SEU projeto Firebase.
   (Veja o guia COMO-COLOCAR-ONLINE.md)
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyAPjCilzKwn9N8gJGACzBAd06hkm_GRE9I",
    authDomain: "prisma-clinica.firebaseapp.com",
    projectId: "prisma-clinica",
    storageBucket: "prisma-clinica.firebasestorage.app",
    messagingSenderId: "839487617014",
    appId: "1:839487617014:web:1920bfa9f0b6eb550d79d7"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
