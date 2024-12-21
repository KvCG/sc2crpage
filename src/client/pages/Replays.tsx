import { useState, useEffect } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { Container, Button } from '@mantine/core';
import { UploadReplayModal } from '../components/Replays/UploadReplayModal';
import { DeleteReplayModal } from '../components/Replays/DeleteReplayModal';
import { ReplayList } from '../components/Replays/ReplayList';
import { useFetch } from '../hooks/useFetch';

export const Replay = () => {
    const [opened, { open, close }] = useDisclosure(false);
    const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
    const [fileIdToDelete, setFileIdToDelete] = useState<string | null>(null);
    const { data: fetchData, loading: fetchLoading, error: fetchError, fetch } = useFetch('replays');

    const fetchReplays = async () => {
        await fetch();
    };

    useEffect(() => {
        fetchReplays();
    }, []);

    const confirmDelete = (fileId: string) => {
        setFileIdToDelete(fileId);
        openDeleteModal();
    };

    return (
        <Container>
            <Button variant="default" onClick={open}>
                Upload a replay
            </Button>

            <UploadReplayModal opened={opened} close={close} fetchReplays={fetchReplays} />
            
            <h1>Replays</h1>
            <ReplayList confirmDelete={confirmDelete} fetchData={fetchData} fetchLoading={fetchLoading} fetchError={fetchError} />
            <DeleteReplayModal opened={deleteModalOpened} close={closeDeleteModal} fileIdToDelete={fileIdToDelete} fetchReplays={fetchReplays} />
        </Container>
    );
};