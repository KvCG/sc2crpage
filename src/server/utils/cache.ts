export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    let nextRefresh = new Date(now)
    
    // If the current time is after 24:00 (i.e., midnight), move the refresh to the next day.
    if (now.getHours() === 24 && now.getMinutes() === 0) {
        nextRefresh.setDate(now.getDate() + 1)
    }
    
    // Set the next refresh time to midnight (00:00) of the next day
    nextRefresh.setHours(24, 0, 0, 0)

    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
