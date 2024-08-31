export const filterEmptyResults = data => {
    if (!data?.length) return []

    return data.filter(player => !isEmpty(player))
}

const isEmpty = obj => {
    for (const prop in obj) {
        if (Object.hasOwn(obj, prop)) {
            return false
        }
    }

    return true
}
