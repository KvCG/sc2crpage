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
        pointsDifference: 0,
        mapWins: 0,
        gamesLeft: participants.length - 1,
    }))

    matches.forEach(match => {
        const winner = standings.find(p => p.id === match.winnerId)
        const loser = standings.find(p => p.id === match.loserId)

        // Get the game scores from scores_csv
        const [player1Score, player2Score] = match.scoresCsv
            .split('-')
            .map(Number)

        if (match.state == 'complete') {
            const winnerGamesWon = Math.max(player1Score, player2Score)
            const loserGamesWon = Math.min(player1Score, player2Score)

            // Update winner
            winner.wins++
            winner.gamesPlayed++
            winner.points += winnerGamesWon
            winner.pointsDifference += winnerGamesWon - loserGamesWon
            winner.mapWins += winnerGamesWon
            winner.gamesLeft--

            // Update loser
            loser.losses++
            loser.gamesPlayed++
            loser.points += loserGamesWon
            loser.pointsDifference += loserGamesWon - winnerGamesWon
            loser.mapWins += loserGamesWon
            loser.gamesLeft--
        }
    })

    // Sort standings based on points, with tie-breakers being pointsDifference and wins
    standings.sort((a, b) => {
        if (b.points === a.points) {
            if (b.pointsDifference === a.pointsDifference) {
                return b.wins - a.wins // Further tie-breaker by match wins
            }
            return b.pointsDifference - a.pointsDifference // Sort by point difference
        }
        return b.points - a.points // Sort by total points
    })

    return standings
}
