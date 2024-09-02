import { readCsv } from '../services/csvParser'

export const verifyPlayer = async player => {
    const reankedPlayers = await readCsv()
    reankedPlayers.forEach(rankedPlayer => {
		if(rankedPlayer.id == player.playerCharacterId){
			player.btag = rankedPlayer.btag
		}
	})
    return player
}
