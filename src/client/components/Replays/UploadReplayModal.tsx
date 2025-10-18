import { useState, useEffect } from 'react'
import {
    Modal,
    Button,
    NativeSelect,
    Textarea,
    Space,
    Notification,
    Flex,
    Text,
} from '@mantine/core'
import { usePost } from '../../hooks/usePost'
import { useFetch } from '../../hooks/useFetch'

export const UploadReplayModal = ({ opened, close, fetchReplays }) => {
    const [fileName, setFileName] = useState('')
    const [fileExtension, setFileExtension] = useState('')
    const [fileBase64, setFileBase64] = useState('')
    const [player1Race, setPlayer1Race] = useState('')
    const [player2Race, setPlayer2Race] = useState('')
    const [description, setDescription] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [showSuccessNotification, setShowSuccessNotification] = useState(false)
    const [showErrorNotification, setShowErrorNotification] = useState(false)
    const [showAnalysisError, setShowAnalysisError] = useState(false)
    const [replayAnalysisData, setReplayAnalysisData] = useState(null)
    const [uploadCompleted, setUploadCompleted] = useState(false)
    const MAX_DESCRIPTION_LENGTH = 100

    const {
        success: postSuccess,
        error: postError,
        loading: postLoading,
        post,
    } = usePost('uploadReplay')
    const { data: replayAnalysis, loading: replayAnalysisLoading, error: replayAnalysisError, fetch } = useFetch('analyzeReplayBase64')

    useEffect(() => {
        if (postSuccess && !uploadCompleted) {
            setUploadCompleted(true)
            setShowSuccessNotification(true)
            setTimeout(() => {
                fetchReplays()
                resetForm()
                close()
            }, 1500)
        }
    }, [postSuccess, uploadCompleted])

    useEffect(() => {
        if (postError) {
            setShowErrorNotification(true)
        }
    }, [postError])

    useEffect(() => {
        if (replayAnalysisError) {
            setShowAnalysisError(true)
        }
    }, [replayAnalysisError])

    useEffect(() => {
        if (!opened) {
            resetForm()
        }
    }, [opened])

    useEffect(() => {
        if (replayAnalysis && !uploadCompleted) {
            setReplayAnalysisData(replayAnalysis)
            setPlayer1Race(replayAnalysis.players["1"].race)
            setPlayer2Race(replayAnalysis.players["2"].race)
            const mapDescription = "Map: " + replayAnalysis.map
            setDescription(mapDescription.slice(0, MAX_DESCRIPTION_LENGTH))
        }
    }, [replayAnalysis, uploadCompleted])

    const handleSubmit = async event => {
        event.preventDefault()

        setErrorMessage('')
        setShowErrorNotification(false)
        setShowSuccessNotification(false)
        setUploadCompleted(false)

        if (description.length > MAX_DESCRIPTION_LENGTH) {
            setErrorMessage(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less. Current: ${description.length}`)
            return
        }

        if (!fileBase64 || !fileName) {
            setErrorMessage('Please select a replay file.')
            return
        }

        if (!replayAnalysisData) {
            setErrorMessage('Please wait for replay analysis to complete.')
            return
        }

        const payload = {
            fileBase64,
            fileName,
            fileExtension,
            player1Race,
            player2Race,
            description,
            replayAnalysis: replayAnalysisData
        }

        try {
            await post(payload)
        } catch (error) {
            setErrorMessage('Failed to upload replay. Please try again.')
        }
    }

    const resetForm = () => {
        setFileName('')
        setFileExtension('')
        setFileBase64('')
        setPlayer1Race('')
        setPlayer2Race('')
        setDescription('')
        setErrorMessage('')
        setShowSuccessNotification(false)
        setShowErrorNotification(false)
        setShowAnalysisError(false)
        setReplayAnalysisData(null)
        setUploadCompleted(false)

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        if (fileInput) {
            fileInput.value = ''
        }
    }

    const handleModalClose = () => {
        resetForm()
        close()
    }

    const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newDescription = event.currentTarget.value
        if (newDescription.length <= MAX_DESCRIPTION_LENGTH) {
            setDescription(newDescription)
            setErrorMessage('')
        }
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const extension = file.name.split('.').pop()
            if (extension !== 'SC2Replay') {
                setErrorMessage('Invalid file type. Please upload a .SC2Replay file.')
                return
            }
            setErrorMessage('')
            setShowAnalysisError(false)
            setReplayAnalysisData(null)
            setUploadCompleted(false)

            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64String = reader.result?.toString().split(',')[1] || ''
                setFileBase64(base64String)
                setFileName(file.name)
                setFileExtension(extension)
                try {
                    await fetch({ "fileBase64": base64String })
                } catch (error) {
                    setErrorMessage('Failed to analyze replay file. Please try again.')
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const remainingChars = MAX_DESCRIPTION_LENGTH - description.length
    const isDescriptionValid = description.length <= MAX_DESCRIPTION_LENGTH
    const canUpload = replayAnalysisData && !replayAnalysisLoading && !replayAnalysisError && isDescriptionValid && fileBase64 && !uploadCompleted

    return (
        <Modal opened={opened} onClose={handleModalClose} title="Upload replays" centered>
            {showSuccessNotification && (
                <Notification
                    color="green"
                    mb="md"
                    onClose={() => setShowSuccessNotification(false)}
                >
                    Replay uploaded successfully!
                </Notification>
            )}
            {showErrorNotification && (
                <Notification
                    color="red"
                    mb="md"
                    onClose={() => setShowErrorNotification(false)}
                >
                    Error uploading replay. Please try again.
                </Notification>
            )}
            {errorMessage && (
                <Notification
                    color="red"
                    mb="md"
                    onClose={() => setErrorMessage('')}
                >
                    {errorMessage}
                </Notification>
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
                        <Notification color="blue" mb="md" withCloseButton={false}>
                            🔄 Analyzing replay... Please wait before uploading.
                        </Notification>
                    ) : showAnalysisError ? (
                        <Notification
                            color="red"
                            mb="md"
                            onClose={() => setShowAnalysisError(false)}
                        >
                            ❌ Error analyzing replay. Please try uploading again.
                        </Notification>
                    ) : replayAnalysisData && !uploadCompleted ? (
                        <>
                            <Notification color="green" mb="md" withCloseButton={false}>
                                ✅ Replay analyzed successfully! You can now upload.
                            </Notification>
                            <Flex gap="md" wrap="wrap">
                                <NativeSelect
                                    label="Player 1 Race (Auto-detected)"
                                    data={['Terran', 'Protoss', 'Zerg']}
                                    value={player1Race}
                                    readOnly
                                    disabled
                                    styles={{
                                        input: {
                                            backgroundColor: '#f8f9fa',
                                            cursor: 'not-allowed'
                                        }
                                    }}
                                />
                                <NativeSelect
                                    label="Player 2 Race (Auto-detected)"
                                    data={['Terran', 'Protoss', 'Zerg']}
                                    value={player2Race}
                                    readOnly
                                    disabled
                                    styles={{
                                        input: {
                                            backgroundColor: '#f8f9fa',
                                            cursor: 'not-allowed'
                                        }
                                    }}
                                />
                            </Flex>
                            <Space h="md" />
                            <Textarea
                                label="Description"
                                placeholder="Enter description (max 100 chars)"
                                value={description}
                                onChange={handleDescriptionChange}
                                maxLength={MAX_DESCRIPTION_LENGTH}
                                error={!isDescriptionValid ? `Description too long (${description.length}/${MAX_DESCRIPTION_LENGTH})` : false}
                                required
                            />
                            <Text size="xs" c={remainingChars < 10 ? "red" : "dimmed"} mt="xs">
                                {remainingChars} characters remaining
                            </Text>
                        </>
                    ) : fileBase64 && !uploadCompleted ? (
                        <Notification color="yellow" mb="md" withCloseButton={false}>
                            ⏳ Waiting for replay analysis...
                        </Notification>
                    ) : null}

                    <Space h="md" />
                    <Button
                        type="submit"
                        disabled={!canUpload || postLoading}
                        loading={postLoading}
                    >
                        {postLoading ? 'Uploading...' :
                            replayAnalysisLoading ? 'Analyzing...' :
                                !replayAnalysisData || uploadCompleted ? 'Select a file first' :
                                    'Upload'}
                    </Button>
                </form>
            </div>
        </Modal>
    )
}