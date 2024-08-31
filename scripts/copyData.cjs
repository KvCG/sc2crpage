const fs = require('fs-extra')
const path = require('path')

// Define source and destination paths
const sourceDir = path.resolve(__dirname, '../src/data') // Replace with your source file path
const destDir = path.resolve(__dirname, '../dist/data') // Replace with your destination folder path

// Function to copy a folder
const copyFolder = async (src, dest) => {
    try {
        await fs.copy(src, dest)
        console.log(`Folder copied from ${src} to ${dest}`)
    } catch (err) {
        console.error('Error copying folder:', err)
        process.exit(1)
    }
}

// Copy the folder
copyFolder(sourceDir, destDir)
