import { useState } from 'react';
import { Modal, Button, Text, Space, Flex, Loader } from '@mantine/core';
import { usePost } from '../../hooks/usePost';

export const DeleteReplayModal = ({ opened, close, fileIdToDelete, fetchReplays }) => {
  const { loading: postLoading, post } = usePost('deleteReplay');

  const handleDelete = async () => {
    if (fileIdToDelete) {
      await post({ fileId: fileIdToDelete });
      fetchReplays();
      close();
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Confirm Deletion" centered>
      <Text>Are you sure you want to delete this replay?</Text>
      <Space h="md" />
      <Flex justify="start" align="center" gap="md">
        <Button color="red" onClick={handleDelete} disabled={postLoading}>
          {postLoading ? <Loader size="xs" color="white" /> : 'Delete'}
        </Button>
        <Button variant="default" onClick={close} disabled={postLoading}>
          Cancel
        </Button>
      </Flex>
    </Modal>
  );
};