// Helper function to split the ids into chunks of 10
export const chunkArray = (array: any[], chunkSize: number) => {
    const result = []
    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize))
    }
    return result
}
