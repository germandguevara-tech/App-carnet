const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

exports.cambiarPasswordUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado");
  }

  const db = getFirestore();
  const snap = await db.collection("Usuarios")
    .where("uid", "==", request.auth.uid)
    .limit(1)
    .get();

  if (snap.empty || snap.docs[0].data().rol !== "admin") {
    throw new HttpsError("permission-denied", "No autorizado");
  }

  const { uid, nuevaPassword } = request.data;
  if (!uid || !nuevaPassword || nuevaPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Datos inválidos");
  }

  await getAuth().updateUser(uid, { password: nuevaPassword });
  return { ok: true };
});
