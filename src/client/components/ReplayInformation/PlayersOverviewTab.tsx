import { Grid, Card, Group, Title, Badge, Stack, Text } from '@mantine/core'
import { IconTrophy, IconCrown, IconX } from '@tabler/icons-react'
import { LEAGUE_COLORS_BY_ID, LEAGUE_NAMES, getLeagueFromReplayId } from '../../../shared/colorTokens'

interface Player {
    name: string
    race: string
    league: number
    is_winner: boolean
}

interface PlayersOverviewTabProps {
    players: Record<string, Player>
}

const raceColors: Record<string, string> = {
    'Terran': 'blue',
    'Protoss': 'yellow', 
    'Zerg': 'grape',
    'Random': 'gray'
}

export const PlayersOverviewTab = ({ players }: PlayersOverviewTabProps) => {
    return (
        <Grid>
            {Object.keys(players).map(playerKey => {
                const player = players[playerKey]
                // Replay league ids are sc2reader's highest_league (1=Bronze .. 7=Grandmaster,
                // 8=Unranked) — resolved against the shared tokens in src/shared/colorTokens.ts
                const sharedLeagueId = getLeagueFromReplayId(player.league)
                const leagueName = sharedLeagueId
                    ? LEAGUE_NAMES[sharedLeagueId]
                    : player.league === 8
                        ? 'Unranked'
                        : 'Unknown'
                const leagueColor = sharedLeagueId ? LEAGUE_COLORS_BY_ID[sharedLeagueId] : '#868E96'
                return (
                    <Grid.Col span={{ base: 12, md: 6 }} key={playerKey}>
                        <Card shadow="sm" p="lg" radius="md" h="100%">
                            <Group justify="space-between" mb="md">
                                <Title order={3} size="h3" c="blue">
                                    Player {playerKey}
                                </Title>
                                {player.is_winner && (
                                    <Badge 
                                        leftSection={<IconTrophy size={12} />}
                                        variant="gradient" 
                                        gradient={{ from: 'yellow', to: 'orange' }}
                                    >
                                        Winner
                                    </Badge>
                                )}
                            </Group>

                            <Stack gap="sm">
                                <Group justify="space-between">
                                    <Text size="md" fw={500}>Name:</Text>
                                    <Text size="md" c="dimmed">{player.name}</Text>
                                </Group>
                                
                                <Group justify="space-between">
                                    <Text size="md" fw={500}>Race:</Text>
                                    <Badge 
                                        variant="light" 
                                        color={raceColors[player.race] || 'gray'}
                                    >
                                        {player.race}
                                    </Badge>
                                </Group>
                                
                                <Group justify="space-between">
                                    <Text size="md" fw={500}>League:</Text>
                                    <Badge 
                                        variant="filled" 
                                        style={{ 
                                            backgroundColor: leagueColor
                                        }}
                                    >
                                        {leagueName}
                                    </Badge>
                                </Group>
                                
                                <Group justify="space-between">
                                    <Text size="md" fw={500}>Result:</Text>
                                    <Badge 
                                        leftSection={player.is_winner ? <IconCrown size={12} /> : <IconX size={12} />}
                                        variant="light" 
                                        color={player.is_winner ? 'green' : 'red'}
                                    >
                                        {player.is_winner ? 'Victory' : 'Defeat'}
                                    </Badge>
                                </Group>
                            </Stack>
                        </Card>
                    </Grid.Col>
                )
            })}
        </Grid>
    )
}