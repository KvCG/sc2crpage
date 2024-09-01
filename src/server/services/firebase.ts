const admin = require('firebase-admin');
const serviceAccount = require('./path/to/your/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'your-project-id.appspot.com', // Replace with your Firebase storage bucket
});

const bucket = admin.storage().bucket();

module.exports = { bucket };
