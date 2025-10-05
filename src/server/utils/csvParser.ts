import { downloadFile } from '../services/driveFileStorage'
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'

let cache = null
const filePath = path.join(__dirname, '../data/ladderCR.csv')

// Helper function to unlink file
const deleteFile = file => {
    return new Promise((resolve, reject) => {
        fs.unlink(file, err => {
            if (err) return reject(err)
            console.log(`${file} was deleted`)
            resolve()
        })
    })
}

export const readCsv = async () => {
    if (!fs.existsSync(filePath)) {
        // Download the file if it does not exist
        await downloadFile('ranked_players', 'ladderCR.csv')
    }

    return new Promise((resolve, reject) => {
        // Check if the cache is valid
        if (cache) {
            return resolve(cache)
        }

        const results: any[] = []
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', data => results.push(data))
            .on('end', () => {
                // Update cache
                cache = results
                resolve(results)
            })
            .on('error', err => reject(err))
    })
}

export const refreshDataCache = async () => {
    console.log('Refreshing cache!')
    cache = null // Clear stored cache

    try {
        await deleteFile(filePath) // Delete the file
        await readCsv() // Re-read the CSV and update cache
    } catch (err) {
        console.error('Error refreshing cache:', err)
    }
}
