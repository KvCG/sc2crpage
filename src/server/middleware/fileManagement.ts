import { bucket } from '../services/firebase'
import path from 'path'

async function uploadFile(filePath: string): Promise<void> {
    await bucket.upload(filePath, {
        destination: path.basename(filePath), // Name of the file in storage
        metadata: {
            contentType: 'text/csv', // Set appropriate content type
        },
    })
    console.log(`${filePath} uploaded to Firebase Storage.`)
}

// Example usage
// uploadFile('path/to/local/file.csv').catch(console.error)

async function downloadFile(fileName: string): Promise<void> {
    const file = bucket.file(fileName)
    const destination = path.join(__dirname, fileName)

    await file.download({ destination })
    console.log(`Downloaded ${fileName} to ${destination}`)
}

// Example usage
// downloadFile('datafile.csv').catch(console.error)

async function deleteFile(fileName: string): Promise<void> {
  const file = bucket.file(fileName);
  await file.delete();
  console.log(`${fileName} deleted from Firebase Storage.`);
}

// Example usage
// deleteFile('datafile.csv').catch(console.error);

async function listFiles(): Promise<void> {
  const [files] = await bucket.getFiles();
  files.forEach(file => {
    console.log(file.name);
  });
}

// Example usage
// listFiles().catch(console.error);

