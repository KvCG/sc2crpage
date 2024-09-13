import { readCsv } from '../services/csvParser'

export const verifyPlayer = async player => {
    const reankedPlayers = await readCsv()
    reankedPlayers.forEach(rankedPlayer => {
        if (rankedPlayer.id == player.playerCharacterId) {
            player.btag = rankedPlayer.btag
            if (rankedPlayer.name) {
				player.name = rankedPlayer.name
            }
        }
    })
    return player
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
