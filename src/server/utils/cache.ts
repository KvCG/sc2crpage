export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    const nextRefresh = new Date()

    // Adjust for the Costa Rica time zone difference (UTC-6)
    const timeZoneOffset = -6 // UTC-6 for Costa Rica
    nextRefresh.setUTCHours(24 + timeZoneOffset, 0, 0, 0) // Set to 12 AM Costa Rica time

    // If the current time is past 12 AM local time, set the next refresh for the next day
    if (now.getTime() >= nextRefresh.getTime()) {
        nextRefresh.setDate(nextRefresh.getDate() + 1)
    }

    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
