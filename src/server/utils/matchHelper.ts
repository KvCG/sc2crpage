export const addMatchCategory = (match, participants) => {
    const mmrRangePremier = Number(process.env.MMR_RANGE_FOR_PREMIER_MATCH)
    const mmrRangeClose = Number(process.env.MMR_RANGE_FOR_CLOSE_MATCH)
    if (!mmrRangePremier && !mmrRangeClose) return match
    const player1 = participants.find(
        participant => participant.id == match.player1_id
    )
    const player2 = participants.find(
        participant => participant.id == match.player2_id
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
//ratingLast = 100 = 30
//ratingAvg = 100 = 30

//ratingLast = 200 = 51
//ratingAvg = 200 = 56

//ratingLast = 250 = 66
//ratingAvg = 250 = 69

//ratingLast = 300 = 75
//ratingAvg = 300 = 83
