import { useState } from 'react'
import { usePost } from '../hooks/usePost'

import { Button, Container } from '@mantine/core'

export const Replay = () => {
    const [fileName, setFileName] = useState('')
    const [fileExtension, setFileExtension] = useState('')
	const [fileBase64, setFileBase64] = useState('')
    const { success, error, loading, post } = usePost()
    const handleSubmit = async event => {
        event.preventDefault()
		const payload = {
            fileBase64,
            fileName,
            fileExtension
        }

        // Add file metadata to FormData
        await post(payload)
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                const base64String =
                    reader.result?.toString().split(',')[1] || ''
                setFileBase64(base64String)
                setFileName(file.name)
                setFileExtension(file.name.split('.').pop() || '')
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <Container>
            {success && <div>File Uploaded</div>}

            {error && <div>Error with the upload</div>}

            <h1>Upload a replay</h1>
            <div>
                <form onSubmit={handleSubmit} className="form">
                    <label htmlFor="file">File</label>
                    <input
                        name="file"
                        type="file"
                        onChange={handleFileChange}
                    />
                    <Button type="submit">
                        {loading ? 'Uploading' : 'Upload'}
                    </Button>
                </form>
            </div>
        </Container>
    )
}
