import { downloadFile } from "../middleware/fileManagement"

const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')

let cache = null
let cacheTimestamp = null
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // Cache expiry time (e.g., 5 minutes)

export const readCsv = async () => {

	await downloadFile('ranked_players/ladderCR.csv')
    const filePath = path.join(__dirname, '../data/ladderCR.csv')

    return new Promise((resolve, reject) => {
        const now = Date.now()

        // Check if the cache is valid
        if (cache && now - cacheTimestamp < CACHE_EXPIRY_MS) {
            return resolve(cache)
        }

        const results = []
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', data => results.push(data))
            .on('end', () => {
                // Update cache
                cache = results
                cacheTimestamp = now
                resolve(results)
            })
            .on('error', err => reject(err))
    })
}
