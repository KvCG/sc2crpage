import { verifyPlayer } from './ranking'

export const formatData = (data, type) => {
    let formattedData = []
    switch (type) {
        case 'search': {
            formattedData = formatSearchData(data)
            break
        }

        case 'ranking': {
            formattedData = formatRankingData(data)
            break
        }
    }

    return formattedData
}

const simplifyPlayerData = data => {
    let players = []
    data.forEach(current => {
        const {
            leagueMax,
            ratingMax,
            totalGamesPlayed,
            currentStats,
            members,
        } = current
        const id = members.character.id
        const btag = members.account.battleTag
        const clan = members?.clan?.tag
        const terranGamesPlayed = members.terranGamesPlayed ?? 1
        const zergGamesPlayed = members.zergGamesPlayed ?? 0
        const protossGamesPlayed = members.protossGamesPlayed ?? 0

        const player = {
            records: { leagueMax, ratingMax, totalGamesPlayed },
            currentSeason: currentStats,
            gamesPerRace: {
                terranGamesPlayed,
                protossGamesPlayed,
                zergGamesPlayed,
            },
            id: id,
            btag: btag,
            clan: clan,
        }

        players.push(player)
    })

    return players
}

const formatSearchData = data => {
    let players = simplifyPlayerData(data)

    return players
}

const formatRankingData = async data => {
    const playerArr = data.flat()

    let simplifiedData = simplifyPlayerData(playerArr)
    // Filter players using an async function
    simplifiedData = await Promise.all(
        simplifiedData.map(async player => {
            if (await verifyPlayer(player)) {
                // console.log(player)
                return player
            }
        })
    )

	// Remove any undefined values from the array (players that did not pass verification)
    simplifiedData = simplifiedData.filter(player => player !== undefined)
	// Sort by descending order based on MMR of the current season
	simplifiedData = simplifiedData.sort((a, b) => b.currentSeason.rating - a.currentSeason.rating)
	return simplifiedData
}
