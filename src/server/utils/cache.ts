export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    const nextRefresh = new Date()

    nextRefresh.setUTCHours(6, 0, 0, 0); // 6 AM UTC = 12 AM UTC-6 (Costa Rica time)

    // If the current time is past 12 AM local time, set the next refresh for the next day
    if (now.getTime() >= nextRefresh.getTime()) {
        nextRefresh.setDate(nextRefresh.getDate() + 1)
    }

    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
