import { loadData } from './localStorage'

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