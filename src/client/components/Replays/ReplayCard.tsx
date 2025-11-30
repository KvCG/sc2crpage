import { useState, useEffect } from 'react'
import { Card, Image, Group, Text, Badge, Flex, Button, Stack } from '@mantine/core'
import { IconDownload, IconInfoCircle, IconFolderOpen, IconTrash } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { formatFileSize } from '../../utils/common'
import { ReplayWithFolder } from '../../../shared/folderTypes'
import terranBanner from '../../assets/terran_banner.png'
import protossBanner from '../../assets/protoss_banner.png'
import zergBanner from '../../assets/zerg_banner.png'

interface ReplayCardProps {
    replay: ReplayWithFolder
    confirmDelete: (file: object) => void
    confirmMove?: (replay: object) => void
}

export const ReplayCard = ({ replay, confirmDelete, confirmMove }: ReplayCardProps) => {
    const [player1Image, setPlayer1Image] = useState('')
    const [player2Image, setPlayer2Image] = useState('')

    const raceImages: Record<string, string> = {
        Terran: terranBanner,
        Protoss: protossBanner,
        Zerg: zergBanner,
    }

    const navigate = useNavigate()

    const handleInformationClick = () => {
        navigate('/replayInformation', { state: { replayAnalysisFileId: replay.replayAnalysisFileId } })
    }

    useEffect(() => {
        setPlayer1Image(raceImages[replay.player1Race] || terranBanner)
        setPlayer2Image(raceImages[replay.player2Race] || terranBanner)
    }, [replay.player1Race, replay.player2Race])

    return (
        <Card
            key={replay.id}
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
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

            <Stack style={{ flex: 1 }} justify="space-between">
                <Stack gap="xs">
                    <Group justify="space-between" mt="md" mb="xs">
                        <Text fw={500}>{replay.name}</Text>
                        <Badge color="pink">{formatFileSize(parseInt(replay.size) || 0)}</Badge>
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
                </Stack>

                <Flex mt="md" gap="sm" justify="center" align="center" wrap="wrap">
                    <Button
                        color="blue"
                        radius="md"
                        size="sm"
                        component="a"
                        href={replay.downloadUrl}
                        download={replay.name}
                        leftSection={<IconDownload size={16} />}
                        variant="light"
                    >
                        Download
                    </Button>
                    <Button
                        color="green"
                        radius="md"
                        size="sm"
                        onClick={handleInformationClick}
                        leftSection={<IconInfoCircle size={16} />}
                        variant="light"
                    >
                        Info
                    </Button>
                    {confirmMove && (
                        <Button
                            color="orange"
                            radius="md"
                            size="sm"
                            onClick={() => confirmMove(replay)}
                            leftSection={<IconFolderOpen size={16} />}
                            variant="light"
                        >
                            Move
                        </Button>
                    )}
                    <Button
                        color="red"
                        size="sm"
                        radius="md"
                        onClick={() => confirmDelete({ replayFileId: replay.id, replayAnalysisFileId: replay.replayAnalysisFileId })}
                        leftSection={<IconTrash size={16} />}
                        variant="light"
                    >
                        Delete
                    </Button>
                </Flex>
            </Stack>
        </Card>
    )
}