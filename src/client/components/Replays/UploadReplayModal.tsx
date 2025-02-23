import { useState, useEffect } from 'react'
import {
    Modal,
    Button,
    NativeSelect,
    Textarea,
    Space,
    Notification,
    Flex,
} from '@mantine/core'
import { usePost } from '../../hooks/usePost'
import { useFetch } from '../../hooks/useFetch'

export const UploadReplayModal = ({ opened, close, fetchReplays }) => {
    const [fileName, setFileName] = useState('')
    const [fileExtension, setFileExtension] = useState('')
    const [fileBase64, setFileBase64] = useState('')
    const [player1Race, setPlayer1Race] = useState('Terran')
    const [player2Race, setPlayer2Race] = useState('Terran')
    const [description, setDescription] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const {
        success: postSuccess,
        error: postError,
        loading: postLoading,
        post,
    } = usePost('uploadReplay')
    const { data: replayAnalysis, loading: replayAnalysisLoading, error: replayAnalysisError, fetch } = useFetch('analyzeReplayBase64')

    useEffect(() => {
        if (replayAnalysis) {
            setPlayer1Race(replayAnalysis.players["1"].race)
            setPlayer2Race(replayAnalysis.players["2"].race)
            setDescription("Map played: " + replayAnalysis.map)
        }
    }, [replayAnalysis])

    const handleSubmit = async event => {
        event.preventDefault()

        const payload = {
            fileBase64,
            fileName,
            fileExtension,
            player1Race,
            player2Race,
            description,
            replayAnalysis
        }

        await post(payload)
        fetchReplays()
        resetForm()
        close()
    }

    const resetForm = () => {
        setFileName('')
        setFileExtension('')
        setFileBase64('')
        setPlayer1Race('Terran')
        setPlayer2Race('Terran')
        setDescription('')
        setErrorMessage('')
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const extension = file.name.split('.').pop()
            if (extension !== 'SC2Replay') {
                setErrorMessage(
                    'Invalid file type. Please upload a .SC2Replay file.'
                )
                return
            }
            setErrorMessage('')
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64String =
                    reader.result?.toString().split(',')[1] || ''
                setFileBase64(base64String)
                setFileName(file.name)
                setFileExtension(extension)
                await fetch({ "fileBase64": base64String })
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <Modal opened={opened} onClose={close} title="Upload replays" centered>
            {postSuccess && <div>Replay Uploaded</div>}
            {postError && <div>Error with the upload</div>}
            {errorMessage && (
                <Notification color="red">{errorMessage}</Notification>
            )}

            <h1>Upload a replay</h1>
            <div>
                <form onSubmit={handleSubmit} className="form">
                    <label htmlFor="file">Replay</label>
                    <input
                        name="file"
                        type="file"
                        onChange={handleFileChange}
                        required
                    />
                    <Space h="md" />
                    {replayAnalysisLoading ? (
                        <div>Loading replay information...</div>
                    ) : replayAnalysisError ? (
                        <div>Error loading replay data</div>
                    ) : replayAnalysis ? (
                        <>
                            <Flex gap="md" wrap="wrap">
                                <NativeSelect
                                    label="Player 1 Race"
                                    placeholder="Select race"
                                    data={['Terran', 'Protoss', 'Zerg']}
                                    value={player1Race}
                                    onChange={event =>
                                        setPlayer1Race(event.currentTarget.value)
                                    }
                                    required
                                />
                                <NativeSelect
                                    label="Player 2 Race"
                                    placeholder="Select race"
                                    data={['Terran', 'Protoss', 'Zerg']}
                                    value={player2Race}
                                    onChange={event =>
                                        setPlayer2Race(event.currentTarget.value)
                                    }
                                    required
                                />
                            </Flex>
                            <Space h="md" />
                            <Textarea
                                label="Description"
                                placeholder="Enter description"
                                value={description}
                                onChange={event =>
                                    setDescription(event.currentTarget.value)
                                }
                                required
                            />
                        </>
                    ) : null}
                    <Space h="md" />

                    <Button type="submit">
                        {postLoading ? 'Uploading' : 'Upload'}
                    </Button>
                </form>
            </div>
        </Modal>
    )
}
