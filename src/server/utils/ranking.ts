import { readCsv } from '../services/csvParser'

export const verifyPlayer = async player => {
    const allowedPlayers = await readCsv()
    let allowed = false


    allowedPlayers.forEach(allowedPlayer => {
        if (allowedPlayer.id == player.id) {
            allowed = true
        }
    })

    return allowed
}
