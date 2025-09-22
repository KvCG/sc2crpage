import { bucket } from '../services/firebase'
import path from 'path'
import fs from 'fs'

export async function uploadFile(
    buffer: Buffer,
    destination: string,
    contentType: string
): Promise<void> {
    if (!bucket) return
    const file = bucket.file(destination)

    await file.save(buffer, {
        metadata: {
            contentType: contentType, // Set the appropriate content type
        },
    })

    console.log(`${destination} uploaded to Firebase Storage.`)
}

export async function downloadFile(
    fbPath: string,
    fileName: string
): Promise<void> {
    try {
        // Ensure the directory exists
        const dataDir = path.join(__dirname, '../data')
        fs.mkdirSync(dataDir, { recursive: true })

        // Construct the destination path
        const destinationPath = path.join(dataDir, fileName)
        console.log(`Destination Path: ${destinationPath}`)

        // Get the file reference from Firebase Storage
    if (!bucket) return
    const file = bucket.file(`${fbPath}/${fileName}`)

        // Download the file to the destination
        await file.download({ destination: destinationPath })

        console.log(`${fileName} has been downloaded to ${destinationPath}`)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`Failed to download file: ${message}`)
    }
}

// Example usage
// downloadFile('datafile.csv').catch(console.error)

// Example helper functions removed due to noUnusedLocals with strict TS config.
