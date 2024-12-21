import { useState, useEffect } from 'react';
import { Card, Image, Group, Text, Badge, Flex, Button } from '@mantine/core';
import { formatFileSize } from '../../utils/common';

export const ReplayCard = ({ replay, confirmDelete }) => {

  const [player1Image, setPlayer1Image] = useState('');
  const [player2Image, setPlayer2Image] = useState('');

  const raceImages = {
    Terran: './client/assets/terran_banner.png',
    Protoss: './client/assets/protoss_banner.png',
    Zerg: './client/assets/zerg_banner.png',
  };

  useEffect(() => {
    setPlayer1Image(raceImages[replay.player1Race]);
    setPlayer2Image(raceImages[replay.player2Race]);
  }, [replay.player1Race, replay.player2Race]);

  return (
    <Card key={replay.id} shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section>
      <Flex>
          <Image
            src={player1Image}
            h={160}
            w="50%"
            alt={`Player 1: ${replay.player1Race}`}
          />
          <Image
            src={player2Image}
            h={160}
            w="50%"
            alt={`Player 2: ${replay.player2Race}`}
          />
        </Flex>
      </Card.Section>

      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500}>{replay.name}</Text>
        <Badge color="pink">{formatFileSize(replay.size)}</Badge>
      </Group>

      <Text size="sm" c="dimmed">
        Player 1 Race: {replay.player1Race}
      </Text>
      <Text size="sm" c="dimmed">
        Player 2 Race: {replay.player2Race}
      </Text>
      <Text size="sm" c="dimmed">
        Description: {replay.description}
      </Text>

      <Text size="sm" c="dimmed">
        Uploaded on {new Date(replay.modifiedTime).toLocaleDateString()}
      </Text>

      <Flex mt="md" gap="sm" justify="center" align="center" wrap="wrap">
        <Button color="blue" radius="md" size="sm" component="a" href={replay.downloadUrl} download={replay.name}>
          Download
        </Button>
        <Button color="red" size="sm" radius="md" onClick={() => confirmDelete(replay.id)}>
          Delete
        </Button>
      </Flex>
    </Card>
  );
};