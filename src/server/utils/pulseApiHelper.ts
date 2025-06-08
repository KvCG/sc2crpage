import { DateTime } from 'luxon'

export const toCostaRicaTime = (isoString: string): DateTime => {
    return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(
        'America/Costa_Rica'
    )
}
