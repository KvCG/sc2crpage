import { useState, useEffect } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { Container, Button } from '@mantine/core'
import { UploadReplayModal } from '../components/Replays/UploadReplayModal'
import { DeleteReplayModal } from '../components/Replays/DeleteReplayModal'
import { ReplayList } from '../components/Replays/ReplayList'
import { FilterReplaysBar } from '../components/Replays/FilterReplaysBar'
import { useFetch } from '../hooks/useFetch'

export const Replay = () => {
    const [opened, { open, close }] = useDisclosure(false)
    const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false)
    const [fileToDelete, setFileToDelete] = useState<object | null>(null)
    const { data: fetchData, loading: fetchLoading, error: fetchError, fetch } = useFetch('replays')
    const [filteredData, setFilteredData] = useState(fetchData)

    const fetchReplays = async () => {
        await fetch()
    }

    useEffect(() => {
        fetchReplays()
    }, [])

    useEffect(() => {
        setFilteredData(fetchData)
    }, [fetchData])

    const confirmDelete = (file: object) => {
        setFileToDelete(file)
        openDeleteModal()
    }

    return (
        <Container>
            <Button variant="default" onClick={open} mt="xl">
                Upload a replay
            </Button>

            <UploadReplayModal opened={opened} close={close} fetchReplays={fetchReplays} />
            
            <FilterReplaysBar fetchData={fetchData} setFilteredData={setFilteredData} />

            <h1>Replays</h1>
            <ReplayList confirmDelete={confirmDelete} fetchData={filteredData} fetchLoading={fetchLoading} fetchError={fetchError} />
            <DeleteReplayModal opened={deleteModalOpened} close={closeDeleteModal} fileToDelete={fileToDelete} fetchReplays={fetchReplays} />
        </Container>
    )
}