import { loadData } from './localStorage'

export const getStandardName = player => {
    if (player.name) return player.name
    if (player.btag) return player.btag.split('#')[0]
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
    // If the number of participants is even
    if (numberOfPlayers % 2 === 0) {
        return numberOfPlayers / 2 // Each match consists of two participants
    } else {
        return (numberOfPlayers - 1) / 2 // One player has a rest
    }
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

