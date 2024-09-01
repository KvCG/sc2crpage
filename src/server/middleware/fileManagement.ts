import { bucket } from '../services/firebase'
import path from 'path'
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

export async function downloadFile(fileName: string): Promise<void> {
	const destinationPath = path.join(__dirname, 'dist/data', fileName)
    const file = bucket.file(fileName)
    await file.download({ destinationPath })
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
