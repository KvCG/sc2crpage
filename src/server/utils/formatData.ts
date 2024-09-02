import { verifyPlayer } from './ranking'

export const formatData = async (data, type) => {
    let formattedData = []
    switch (type) {
        case 'search': {
            formattedData = formatSearchData(data)
            break
        }

        case 'ranking': {
            formattedData = await formatRankingData(data)
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
    data = await Promise.all(
        data.map(async data => {
            const verifiedPlayerData = await verifyPlayer(data)
            return verifiedPlayerData
        })
    )

    return data.sort((a, b) => b.ratingLast - a.ratingLast)
}