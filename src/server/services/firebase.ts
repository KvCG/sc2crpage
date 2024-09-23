import admin from 'firebase-admin'
import 'dotenv/config'

let bucket = null

try {
    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
    )

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'sc2cr-bc7bf.appspot.com',
    })

	bucket = admin.storage().bucket()
} catch (error) {
	console.log('Firebase init error. Ignore if you have ladder.csv')
}


export { bucket }
