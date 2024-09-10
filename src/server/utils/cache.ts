export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    const nextRefresh = new Date() // Create a new Date object representing the current time

    // Set nextRefresh to midnight (00:00) of the current day
    nextRefresh.setHours(0, 0, 0, 0)

    // If the current time is past midnight, move nextRefresh to the next day
    if (now.getTime() >= nextRefresh.getTime()) {
        nextRefresh.setDate(now.getDate() + 1)
    }

    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
