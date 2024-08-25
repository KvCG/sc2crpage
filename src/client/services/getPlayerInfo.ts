import api from './sc2pulseApi.ts'

export const search = async (searchTerm: string) => {
    const response = await api.get(`api/character/search?term=${searchTerm}`)

    return response
}