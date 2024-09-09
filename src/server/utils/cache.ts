export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    let nextRefresh = new Date(now)

    if (now.getHours() < 12) {
        // Set to 12 PM today
        nextRefresh.setHours(12, 0, 0, 0)
    } else {
        // Set to 12 AM tomorrow
        nextRefresh.setHours(24, 0, 0, 0)
    }

    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
