export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    let nextRefresh = new Date(now)
    nextRefresh.setHours(24, 0, 0, 0)
    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
