import { filterEmptyResults } from "./filterResults"

export const formatData = (data, type) => {
    let formattedData = []
    switch (type) {
        case 'search': {
            formattedData = formatSearchData(data)
            break
        }

		case 'ranking': {
            formattedData = formatSearchData(data)
            break
        }
    }
    return formattedData
}

const formatSearchData = data => {
	console.log('uunfilterred: ',data)
	data = filterEmptyResults(data)
	console.log('filterred: ',data)
    let players = []
    data.forEach((current) => {
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
            currentSeason:  currentStats ,
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
