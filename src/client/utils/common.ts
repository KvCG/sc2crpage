export const getStandardName = player => {
    if (player.name) return player.name
    if (player.btag) return player.btag.split('#')[0]
}

export const toCRtime = (dateStr) => {
    const date = new Date(dateStr)

    // Opciones para formatear la fecha con mes en texto
    const options = {
        timeZone: 'America/Costa_Rica',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }

    return new Intl.DateTimeFormat('es-CR', options).format(date)
}
