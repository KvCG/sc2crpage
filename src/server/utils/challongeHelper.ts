export const addMatchCategory = (match, participants) => {
    const mmrRangePremier = Number(process.env.MMR_RANGE_FOR_PREMIER_MATCH)
    const mmrRangeClose = Number(process.env.MMR_RANGE_FOR_CLOSE_MATCH)
    if (!mmrRangePremier && !mmrRangeClose) return match
    const player1 = participants.find(
        participant => participant.id == match.player1Id
    )
    const player2 = participants.find(
        participant => participant.id == match.player2Id
    )

    const mmrDiff = Math.abs(player1?.ratingAvg - player2?.ratingAvg)

    if (mmrDiff <= mmrRangePremier) {
        match.isPremier = true
        match.isClose = false
    } else if (mmrDiff <= mmrRangeClose) {
        match.isPremier = false
        match.isClose = true
    } else {
        match.isPremier = false
        match.isClose = false
    }

    return match
}

export const getStandingsData = (info, participants, matches) => {
    let standings = participants.map(participant => ({
        id: participant.id,
        name: participant.name,
		challongeUsername: participant.challongeUsername,
		btag: participant.btag,
		race: participant.race,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        points: 0,
    }))

    matches.forEach(match => {
        const winner = standings.find(p => p.id === match.winnerId)
        const loser = standings.find(p => p.id === match.loserId)

        if (winner) {
            winner.wins++
            winner.gamesPlayed++
            winner.points += Number(info.ptsForMatchWin)
        }

        if (loser) {
            loser.losses++
            loser.gamesPlayed++
        }
    })

    // Sort standings based on points or wins
    standings.sort((a, b) => b.points - a.points)

	return standings
}
