import bronze from '../assets/Bronze.png'
import silver from '../assets/Silver.png'
import gold from '../assets/Gold.png'
import plat from '../assets/Platinum.png'
import diamond from '../assets/Diamond.png'
import master from '../assets/Master.png'
import gm from '../assets/Grandmaster.png'
import unknownRank from '../assets/unknownRank.svg'

export const getLeagueSrc = leagueType => {
    switch (leagueType) {
        case 0:
            return bronze
        case 1:
            return silver
        case 2:
            return gold
        case 3:
            return plat
        case 4:
            return diamond
        case 5:
            return master
        case 6:
            return gm
        default:
            return unknownRank
    }
}

export const addPositionChangeIndicator = (currentRanking, previousRanking) => {
    const finalRanking = currentRanking.map(
        (currentPlayer, currentPosition) => {
            const previousPosition = previousRanking?.findIndex(
                player => player.btag == currentPlayer.btag
            )
            if (currentPosition > previousPosition) {
                currentPlayer.positionChangeIndicator = '\u25BC'
            }
            if (currentPosition < previousPosition) {
                currentPlayer.positionChangeIndicator = '\u25B2'
            }
            if (
                !previousPosition ||
                currentPosition == previousPosition ||
                previousPosition == -1
            ) {
                // Not found in previous ranking
                currentPlayer.positionChangeIndicator = ''
            }

            return currentPlayer
        }
    )

    return finalRanking
}

export const addOnlineIndicator = (lastPlayed, online) => {
    if (online) {
		return '🟢'
	}

    return lastPlayed
}

