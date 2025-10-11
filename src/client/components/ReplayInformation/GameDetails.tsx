import { Card, Title, Grid, Group, Text, Badge } from '@mantine/core'
import { IconCalendar, IconClock, IconDeviceGamepad2, IconUser, IconMap } from '@tabler/icons-react'

interface GameDetailsProps {
    replayInformation: {
        category: string
        unix_timestamp: number
        game_type: string
        region: string
        map: string
        frames: number
        frames_per_second: number
    }
}

export const GameDetails = ({ replayInformation }: GameDetailsProps) => {
    const calculateGameTime = (frames: number, fps: number) => {
        const totalSeconds = frames / fps
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = Math.floor(totalSeconds % 60)
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
    }

    return (
        <Card shadow="sm" p="lg" radius="md" mb="xl">
            <Title order={2} mb="md" c="blue">Game Details</Title>
            <Grid>
                <Grid.Col span={{ xs: 12, sm: 6, md: 4 }}>
                    <Group gap="xs">
                        <IconCalendar size={16} color="gray" />
                        <Text size="sm" fw={500}>Category:</Text>
                        <Text size="sm" c="dimmed">{replayInformation.category}</Text>
                    </Group>
                </Grid.Col>
                <Grid.Col span={{ xs: 12, sm: 6, md: 4 }}>
                    <Group gap="xs">
                        <IconClock size={16} color="gray" />
                        <Text size="sm" fw={500}>Date:</Text>
                        <Text size="sm" c="dimmed">
                            {new Date(replayInformation.unix_timestamp * 1000).toLocaleString()}
                        </Text>
                    </Group>
                </Grid.Col>
                <Grid.Col span={{ xs: 12, sm: 6, md: 4 }}>
                    <Group gap="xs">
                        <IconDeviceGamepad2 size={16} color="gray" />
                        <Text size="sm" fw={500}>Type:</Text>
                        <Text size="sm" c="dimmed">{replayInformation.game_type}</Text>
                    </Group>
                </Grid.Col>
                <Grid.Col span={{ xs: 12, sm: 6, md: 4 }}>
                    <Group gap="xs">
                        <IconUser size={16} color="gray" />
                        <Text size="sm" fw={500}>Region:</Text>
                        <Text size="sm" c="dimmed">{replayInformation.region}</Text>
                    </Group>
                </Grid.Col>
                <Grid.Col span={{ xs: 12, sm: 6, md: 4 }}>
                    <Group gap="xs">
                        <IconMap size={16} color="gray" />
                        <Text size="sm" fw={500}>Map:</Text>
                        <Text size="sm" c="dimmed">{replayInformation.map}</Text>
                    </Group>
                </Grid.Col>
                <Grid.Col span={{ xs: 12, sm: 6, md: 4 }}>
                    <Group gap="xs">
                        <IconClock size={16} color="gray" />
                        <Text size="sm" fw={500}>Duration:</Text>
                        <Badge variant="light" color="blue">
                            {calculateGameTime(replayInformation.frames, replayInformation.frames_per_second)}
                        </Badge>
                    </Group>
                </Grid.Col>
            </Grid>
        </Card>
    )
}