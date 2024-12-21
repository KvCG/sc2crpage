import { useState } from 'react'
import { deleteReplay, uploadReplay } from '../services/api'

export const usePost = type => {
    const [success, setSuccess] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const postData = async body => {
        let result = null
        switch (type) {
            case 'uploadReplay':
                result = await uploadReplay(body)
                break
            case 'deleteReplay':
                result = await deleteReplay(body)
                break
        }

        return result
    }

    const post = async body => {
        setLoading(true)
        try {
            setSuccess((await postData(body)) ?? '')
        } catch (error) {
            setError('Failed to post data. Please try again later.')
            setSuccess('')
        } finally {
            setLoading(false)
        }
    }

    return { success, loading, error, post }
}
