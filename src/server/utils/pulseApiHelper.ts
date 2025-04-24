import { DateTime } from 'luxon'

// Helper function to split the ids into chunks of 10
export const chunkArray = (array: any[], chunkSize: number) => {
    const result = []
    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize))
    }
    return result
}

export const retryDelay = (attempt: number) => Math.pow(2, attempt) * 1000

export const toCostaRicaTime = (isoString: string): DateTime => {
    return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(
        'America/Costa_Rica'
    )
}
