import { useState } from 'react';
import { Modal, Button, NativeSelect, Textarea, Space, Notification, Flex } from '@mantine/core';
import { usePost } from '../../hooks/usePost';

export const UploadReplayModal = ({ opened, close, fetchReplays }) => {
  const [fileName, setFileName] = useState('');
  const [fileExtension, setFileExtension] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [player1Race, setPlayer1Race] = useState<string | null>(null);
  const [player2Race, setPlayer2Race] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { success: postSuccess, error: postError, loading: postLoading, post } = usePost('uploadReplay');

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      fileBase64,
      fileName,
      fileExtension,
      player1Race,
      player2Race,
      description,
    };

    await post(payload);
    fetchReplays();
    close();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop();
      if (extension !== 'SC2Replay') {
        setErrorMessage('Invalid file type. Please upload a .SC2Replay file.');
        return;
      }
      setErrorMessage('');
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result?.toString().split(',')[1] || '';
        setFileBase64(base64String);
        setFileName(file.name);
        setFileExtension(extension);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Upload replays" centered>
      {postSuccess && <div>Replay Uploaded</div>}
      {postError && <div>Error with the upload</div>}
      {errorMessage && <Notification color="red">{errorMessage}</Notification>}

      <h1>Upload a replay</h1>
      <div>
        <form onSubmit={handleSubmit} className="form">
          <label htmlFor="file">Replay</label>
          <input name="file" type="file" onChange={handleFileChange} required />
          <Space h="md" />

          <Flex gap="md" wrap="wrap">
            <NativeSelect
              label="Player 1 Race"
              placeholder="Select race"
              data={['Terran', 'Protoss', 'Zerg']}
              value={player1Race}
              onChange={(event) => setPlayer1Race(event.currentTarget.value)}
              required
            />
            <NativeSelect
              label="Player 2 Race"
              placeholder="Select race"
              data={['Terran', 'Protoss', 'Zerg']}
              value={player2Race}
              onChange={(event) => setPlayer2Race(event.currentTarget.value)}
              required
            />
          </Flex>
          <Space h="md" />

          <Textarea
            label="Description"
            placeholder="Enter description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            required
          />
          <Space h="md" />

          <Button type="submit">{postLoading ? 'Uploading' : 'Upload'}</Button>
        </form>
      </div>
    </Modal>
  );
};