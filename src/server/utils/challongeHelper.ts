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
        wins: 0, // Match wins
        losses: 0, // Match losses
        gamesPlayed: 0, // Matches played
        points: 0, // Points awarded based on game wins
        pointsDifference: 0, // Points difference based on game wins/losses
        gamesLeft: participants.length - 1, // assuming round-robin format
        forfeited: false, // starts as false, but will be true if the player leaves the tournament
    }))

    matches.forEach(match => {
        const winner = standings.find(p => p.id === match.winnerId)
        const loser = standings.find(p => p.id === match.loserId)

        // Get the game scores from scores_csv (e.g., "2-1")
        const [player1Score, player2Score] = match.scoresCsv
            .split('-')
            .map(Number)

        if (match.state === 'complete') {
            // Handle BYE: If the match is a bye, award the point to the participant
            if (match.loserId === null && winner) {
                winner.points += parseFloat(info.pts_for_bye) // 1 point for bye
                winner.gamesLeft--
                winner.gamesPlayed++ // Count the bye as a game played
                return
            }

            // Handle 0-0 (forfeited) matches
            if (player1Score === 0 && player2Score === 0) {
                if (winner) winner.gamesLeft--
                if (loser) loser.gamesLeft--
                return // No updates to points or wins/losses
            }

            const winnerGamesWon = Math.max(player1Score, player2Score)
            const loserGamesWon = Math.min(player1Score, player2Score)

            // Update winner points and stats
            if (winner) {
                winner.wins++ // Match win count
                winner.gamesPlayed++
                winner.points += winnerGamesWon // Points per game won
                winner.pointsDifference += winnerGamesWon - loserGamesWon
                winner.gamesLeft--
                winner.forfeited = false // participated in the tournament
            }

            // Update loser points and stats
            if (loser) {
                loser.losses++ // Match loss count
                loser.gamesPlayed++
                loser.points += loserGamesWon // Points per game won
                loser.pointsDifference += loserGamesWon - winnerGamesWon
                loser.gamesLeft--
                loser.forfeited = false // participated in the tournament
            }
        } else {
            // Count matches for players who forfeited
            if (winner && loser && (winner.forfeited || loser.forfeited)) {
                if (winner) winner.gamesPlayed++ // Count match played
                if (loser) loser.gamesPlayed++ // Count match played
            }
        }
    })

    // Sort standings with the following rules:
    standings.sort((a, b) => {
        // Players who have not played any matches go to the bottom
        if (a.gamesPlayed === 0 && b.gamesPlayed !== 0) return 1 // 'a' goes below 'b'
        if (b.gamesPlayed === 0 && a.gamesPlayed !== 0) return -1 // 'b' goes below 'a'

        // If both players have the same points, check head-to-head record first
        if (b.points === a.points) {
            const headToHeadMatch = matches.find(
                match =>
                    (match.winnerId === a.id && match.loserId === b.id) ||
                    (match.winnerId === b.id && match.loserId === a.id)
            )

            // Apply head-to-head logic
            if (headToHeadMatch) {
                if (headToHeadMatch.winnerId === a.id) return -1 // 'a' won head-to-head, rank 'a' higher
                if (headToHeadMatch.winnerId === b.id) return 1 // 'b' won head-to-head, rank 'b' higher
            }

            // If no head-to-head, sort by pointsDifference
            if (b.pointsDifference === a.pointsDifference) {
                return b.wins - a.wins // Tie-breaker by match wins
            }
            return b.pointsDifference - a.pointsDifference // Sort by point difference
        }

        return b.points - a.points // Sort by total points
    })

    return standings
}
