import { useState } from 'react'
import { deleteReplay, uploadReplay, createFolder, moveReplay, deleteFolder, renameFolder } from '../services/api'

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
            case 'createFolder':
                result = await createFolder(body)
                break
            case 'moveReplay':
                result = await moveReplay(body)
                break
            case 'deleteFolder':
                result = await deleteFolder(body)
                break
            case 'renameFolder':
                result = await renameFolder(body)
                break
        }

        return result
    }

    const post = async body => {
        setLoading(true)
        setError(null) // Clear previous errors
        try {
            const result = await postData(body)
            setSuccess(result?.data ?? result ?? '')
        } catch (error: any) {
            // Extract error message from API response
            let errorMessage = 'Failed to post data. Please try again later.'

            if (error?.response?.data?.error) {
                errorMessage = error.response.data.error
            } else if (error?.message) {
                errorMessage = error.message
            }

            setError(errorMessage)
            setSuccess('')
            throw error // Re-throw so calling code can handle it
        } finally {
            setLoading(false)
        }
    }

    return { success, loading, error, post }
}
