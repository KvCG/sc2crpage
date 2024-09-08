export const saveRankingData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data))
}

export const getRankingData = key => {
	const data = localStorage.getItem(key)
    return JSON.parse(data)
}

export const isValid = (key, data) => {
    if (!data) return false
    const now = new Date().getTime()
    if (now > data.expiry) {
        localStorage.removeItem(key)
        return false
    }
    return true
}
