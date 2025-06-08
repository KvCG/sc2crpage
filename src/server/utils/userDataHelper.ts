import { readCsv } from './csvParser'
import { formatData } from './formatData'
import { getTop } from '../services/pulseApi'

export const verifyPlayer = async player => {
    const rankedPlayers = await readCsv()
    rankedPlayers.forEach(rankedPlayer => {
        if (rankedPlayer.id == player.playerCharacterId) {
            player.btag = rankedPlayer.btag
            if (rankedPlayer.name) {
                player.name = rankedPlayer.name
            }
        }
    })
    return player
}

export const verifyChallongeParticipant = async challongeParticipant => {
    // TODO Check where this is used and updated
    const snapshot = getTop()
    const rankedPlayers = await readCsv()
    for (const rankedPlayer of rankedPlayers) {
        if (rankedPlayer?.challongeId == challongeParticipant.challongeUserId) {
            challongeParticipant.btag = rankedPlayer.btag
            challongeParticipant.name = null
            if (rankedPlayer.name) {
                challongeParticipant.name = rankedPlayer.name
            }
            if (snapshot) {
                const formattedData = await formatData(snapshot, 'ranking')
                const match = formattedData.find(
                    player => player.playerCharacterId == rankedPlayer.id
                )
                if (match) {
                    challongeParticipant.leagueTypeLast = match.leagueTypeLast
                    challongeParticipant.race = match.race
                    challongeParticipant.ratingLast = match.ratingLast
                    challongeParticipant.leagueTypeLast = match.leagueTypeLast
					challongeParticipant.ratingAvg = match.ratingAvg
                }
            }
        }
    }

    return challongeParticipant
}

export const filterByHighestRatingLast = players => {
    const result = {}

    players.forEach(player => {
        const { btag, ratingLast } = player

        // Check if this btag already exists in the result object
        if (!result[btag] || result[btag].ratingLast < ratingLast) {
            result[btag] = player
        }
    })

    // Convert the result object back to an array
    return Object.values(result)
}
