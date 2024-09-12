export const saveData = (key, data) => {
    if (!data || !data.data || !data.data?.length) return
    localStorage.setItem(key, JSON.stringify(data))
}

export const saveSnapShot = (key, data) => {
    if (!data) return
    localStorage.setItem(key, JSON.stringify(data))
}

export const saveDepth = (key, data) => {
    if (!data) return
    localStorage.setItem(key, JSON.stringify(data))
}

export const loadData = key => {
    const data = localStorage.getItem(key)
    return JSON.parse(data)
}

export const isValid = (key, data) => {
    if (!data) return false
    const now = Date.now()
    if (now > data.expiry) {
        if (key) {
            localStorage.removeItem(key)
			console.log('Removing:', key)
        }

        return false
    }
    return true
}
