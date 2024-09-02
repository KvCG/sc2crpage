import { useState } from 'react'
import { upload } from '../services/api'

export const usePost = () => {
    const [success, setSuccess] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const post = async body => {
        setLoading(true)
        try {
            setSuccess((await upload(body)) ?? '')
        } catch (error) {
            console.error('Error fetching ranking data:', error)
            setError('Failed to fetch data. Please try again later.')
            setSuccess('')
        } finally {
            setLoading(false)
        }
    }

    return { success, loading, error, post }
}
