const admin = require("firebase-admin");

const config = require("./config");
const seriveAccountKey = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(seriveAccountKey),
  databaseURL: config.databaseURL,
  storageBucket: config.storageBucket,
});

const db = admin.firestore();

module.exports = { admin, db };
