import axios, { AxiosError } from 'axios'
import https from 'https'

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    keepAliveMsecs: 15000,
    timeout: 30000,
})

const api = axios.create({
    baseURL: 'https://api.challonge.com/v1',
    httpAgent: agent,
})

const tournament = process.env.CURRENT_TOURNAMENT
const apiKey = process.env.CHALLONGE_API_KEY

export const getParticipants = async () => {
    try {
		if(!tournament) throw new AxiosError('No CURRENT_TOURNAMENT')
		if(!apiKey) throw new AxiosError('CHALLONGE_API_KEY needed')
        const response = await api.get(
            `/tournaments/${tournament}/participants.json?api_key=${apiKey}`
        )
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log('Challonge API error:', axiosError.message)
		return []
    }
}
