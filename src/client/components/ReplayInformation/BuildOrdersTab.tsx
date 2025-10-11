import { useState } from 'react'
import { 
    Grid, 
    Card, 
    Group, 
    Title, 
    Badge, 
    Text, 
    ActionIcon, 
    Collapse, 
    Divider, 
    Table, 
    Stack 
} from '@mantine/core'
import { 
    IconTrophy, 
    IconChevronDown, 
    IconChevronUp, 
    IconAlertCircle 
} from '@tabler/icons-react'

interface BuildOrderItem {
    supply: number
    time: string
    name: string
}

interface Player {
    name: string
    race: string
    is_winner: boolean
    buildOrder?: BuildOrderItem[]
}

interface BuildOrdersTabProps {
    players: Record<string, Player>
}

const raceColors: Record<string, string> = {
    'Terran': 'blue',
    'Protoss': 'yellow', 
    'Zerg': 'grape',
    'Random': 'gray'
}

export const BuildOrdersTab = ({ players }: BuildOrdersTabProps) => {
    const [expandedPlayers, setExpandedPlayers] = useState<Record<string, boolean>>({})

    const togglePlayerExpansion = (playerId: string) => {
        setExpandedPlayers(prev => ({
            ...prev,
            [playerId]: !(prev[playerId] ?? true)
        }))
    }

    return (
        <Grid>
            {Object.keys(players).map(playerKey => {
                const player = players[playerKey]
                const isExpanded = expandedPlayers[playerKey] ?? true
                
                return (
                    <Grid.Col span={{ base: 12, lg: 6 }} key={playerKey}>
                        <Card shadow="sm" p="lg" radius="md">
                            <Group 
                                justify="space-between" 
                                mb="md"
                                style={{ cursor: 'pointer' }}
                                onClick={() => togglePlayerExpansion(playerKey)}
                            >
                                <Group gap="sm">
                                    <Title order={4} size="h4" c="blue">
                                        Player {playerKey}
                                    </Title>
                                    <Badge variant="light" color={raceColors[player.race] || 'gray'}>
                                        {player.race}
                                    </Badge>
                                    {player.is_winner && (
                                        <Badge 
                                            leftSection={<IconTrophy size={12} />}
                                            variant="filled" 
                                            color="yellow"
                                        >
                                            Winner
                                        </Badge>
                                    )}
                                </Group>
                                
                                <ActionIcon variant="subtle" color="gray">
                                    {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                </ActionIcon>
                            </Group>

                            <Text size="sm" c="dimmed" mb={isExpanded ? "md" : 0}>
                                {player.name}
                            </Text>

                            <Collapse in={isExpanded}>
                                <Divider mb="md" />
                                <Title order={5} size="h5" mb="sm">Build Order</Title>

                                {player.buildOrder && player.buildOrder.length > 0 ? (
                                    <Table 
                                        striped 
                                        highlightOnHover 
                                        withTableBorder 
                                        withColumnBorders
                                    >
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th ta="center">Supply</Table.Th>
                                                <Table.Th ta="center">Time</Table.Th>
                                                <Table.Th>Unit/Building</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {player.buildOrder.map((order, index) => (
                                                <Table.Tr key={index}>
                                                    <Table.Td ta="center">
                                                        <Badge size="sm" variant="outline">
                                                            {order.supply}
                                                        </Badge>
                                                    </Table.Td>
                                                    <Table.Td ta="center">
                                                        <Text size="sm" c="dimmed">
                                                            {order.time}
                                                        </Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm" fw={500}>
                                                            {order.name}
                                                        </Text>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                ) : (
                                    <Card bg="gray.0" p="lg" radius="sm">
                                        <Stack align="center" gap="sm">
                                            <IconAlertCircle size={24} color="gray" />
                                            <Text size="sm" c="dimmed" ta="center">
                                                No build orders available
                                            </Text>
                                        </Stack>
                                    </Card>
                                )}
                            </Collapse>
                        </Card>
                    </Grid.Col>
                )
            })}
        </Grid>
    )
}