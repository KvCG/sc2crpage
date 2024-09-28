export const getStandardName = player => {
    if (player.name) return player.name
    if (player.btag) return player.btag.split('#')[0]
}
