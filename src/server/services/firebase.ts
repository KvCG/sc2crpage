import admin from 'firebase-admin'

const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'sc2cr-bc7bf.appspot.com', // Replace with your Firebase storage bucket
})

const bucket = admin.storage().bucket()

export { bucket }
