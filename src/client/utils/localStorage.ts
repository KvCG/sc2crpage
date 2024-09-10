export const saveData = (key, data) => {
    if (!data || !data.data || !data.data?.length) return
    localStorage.setItem(key, JSON.stringify(data))
}

export const saveSnapShot = (key, data) => {
    if (!data) return
    localStorage.setItem(key, JSON.stringify(data))
}

export const loadData = key => {
    const data = localStorage.getItem(key)
    return JSON.parse(data)
}

export const isValid = (key, data) => {
    if (!data) return false
    const now = new Date().getTime()
    if (now > data.expiry) {
        return false
    }
    return true
}
