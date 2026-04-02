/* ============================================
   PRISMA - Configuracao do Firebase

   INSTRUCOES: Substitua os valores abaixo
   pelos dados do SEU projeto Firebase.
   (Veja o guia COMO-COLOCAR-ONLINE.md)
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyCthfBOmNUU_vOp-eSKol4wXZkClT-UtwM",
    authDomain: "prisma-clinica-ae257.firebaseapp.com",
    projectId: "prisma-clinica-ae257",
    storageBucket: "prisma-clinica-ae257.firebasestorage.app",
    messagingSenderId: "100140286581",
    appId: "1:100140286581:web:316d4318cde38d7c986e3c"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
