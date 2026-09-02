import { loadData } from './localStorage'

/**
 * Formats an ISO timestamp as a compact relative time ("5m ago", "2h ago", "3d ago").
 * Under a minute reads "just now"; beyond 7 days it falls back to the full
 * Costa Rica date. Accepts an explicit `now` for deterministic tests and returns
 * the raw string when the value is not an ISO date (e.g., legacy snapshots
 * cached in the full locale format).
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
    // Strict ISO guard: browsers parse some locale strings too, and the
    // fallback must behave the same everywhere
    if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return iso
    const then = new Date(iso)
    if (isNaN(then.getTime())) return iso

    const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000))
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Costa_Rica',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(then)
}

export const getStandardName = player => {
    if (player.name) return player.name
    if (player.btag) return player.btag.split('#')[0]
    if (player.challongeUsername) return player.challongeUsername
}

export const toCRtime = dateStr => {
    const date = new Date(dateStr)

    // Opciones para formatear la fecha con mes en texto
    const options = {
        timeZone: 'America/Costa_Rica',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }

    return new Intl.DateTimeFormat('es-CR', options).format(date)
}

export const calculateRounds = numberOfPlayers => {
    return numberOfPlayers
}

export const filterMatches = (matches, round, state) => {
    return matches.filter(match => {
        const roundMatches = round !== null ? match.round === round : true // Check round if provided
        const stateMatches = state !== null ? match.state === state : true // Check state if provided
        return roundMatches && stateMatches // Return true if either round or state matches
    })
}

export const getParticipant = id => {
    const participants = loadData('participants')

    return participants.find(participant => participant.id == id)
}

export const formatFileSize = (sizeInBytes: number) => {
    if (sizeInBytes >= 1073741824) {
        return (sizeInBytes / 1073741824).toFixed(2) + ' GB'
    } else if (sizeInBytes >= 1048576) {
        return (sizeInBytes / 1048576).toFixed(2) + ' MB'
    } else if (sizeInBytes >= 1024) {
        return (sizeInBytes / 1024).toFixed(2) + ' KB'
    } else {
        return sizeInBytes + ' bytes'
    }
}
