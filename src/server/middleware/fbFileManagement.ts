import { bucket } from '../services/firebase'
import path from 'path'
const fs = require('fs')

export async function uploadFile(
    buffer: Buffer,
    destination: string,
    contentType: string
): Promise<void> {
    const file = bucket.file(destination)

    await file.save(buffer, {
        metadata: {
            contentType: contentType, // Set the appropriate content type
        },
    })

    console.log(`${destination} uploaded to Firebase Storage.`)
}

// Example usage
// uploadFile('path/to/local/file.csv').catch(console.error)

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
        const file = bucket.file(`${fbPath}/${fileName}`)

        // Download the file to the destination
        await file.download({ destination: destinationPath })

        console.log(`${fileName} has been downloaded to ${destinationPath}`)
    } catch (error) {
        console.error(`Failed to download file: ${error.message}`)
    }
}

// Example usage
// downloadFile('datafile.csv').catch(console.error)

async function deleteFile(fileName: string): Promise<void> {
    const file = bucket.file(fileName)
    await file.delete()
    console.log(`${fileName} deleted from Firebase Storage.`)
}

// Example usage
// deleteFile('datafile.csv').catch(console.error);

async function listFiles(): Promise<void> {
    const [files] = await bucket.getFiles()
    files.forEach(file => {
        console.log(file.name)
    })
}

// Example usage
// listFiles().catch(console.error);
