import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useFetch } from '../hooks/useFetch'
import { Container, Grid, Text, Title, Table, Paper, Space } from '@mantine/core'

export const ReplayInformation = () => {
    const location = useLocation()
    const replayAnalysisFileId = location.state?.replayAnalysisFileId
    const { data: replayInformation = null, loading: fetchLoading, error: fetchError, fetch } = useFetch('replayAnalysis')

    useEffect(() => {
        if (replayAnalysisFileId) {
            fetch({ 'replayAnalysisFileId': replayAnalysisFileId })
        }
    }, [])

    const leagueMap = {
        0: 'Bronze',
        1: 'Silver',
        2: 'Gold',
        3: 'Platinum',
        4: 'Diamond',
        5: 'Master',
        6: 'GrandMaster'
    }

    const calculateGameTime = (frames, fps) => {
        const totalSeconds = frames / fps
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = Math.floor(totalSeconds % 60)
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
    }

    return (
        <Container>
            <Title order={1} size="h1" c="blue">Replay Information</Title>
            {fetchLoading && <Text size="md" c="white">Loading...</Text>}
            {fetchError && <Text size="md" c="red">{fetchError}</Text>}
            {(!fetchLoading && !replayInformation) || replayInformation && Object.keys(replayInformation).length === 0 && <Text size="md" c="dimmed">No replay information available</Text>}
            {replayInformation && Object.keys(replayInformation).length != 0 && (
                <div>
                    <Text size="md" c="dimmed">Category: {replayInformation.category}</Text>
                    <Text size="md" c="dimmed">Timestamp: {new Date(replayInformation.unix_timestamp * 1000).toLocaleString()}</Text>
                    <Text size="md" c="dimmed">Game Type: {replayInformation.game_type}</Text>
                    <Text size="md" c="dimmed">Region: {replayInformation.region}</Text>
                    <Text size="md" c="dimmed">Map: {replayInformation.map}</Text>
                    <Text size="md" c="dimmed">Game Time: {calculateGameTime(replayInformation.frames, replayInformation.frames_per_second)}</Text>
                    <Grid>
                        {replayInformation?.players && Object.keys(replayInformation.players).map(playerKey => {
                            const player = replayInformation.players[playerKey]
                            return (
                                <Grid.Col span={6} key={playerKey}>
                                    <Paper shadow="xs" padding="md">
                                        <Title order={3} size="h3" c="blue">Player {playerKey}</Title>
                                        <Text size="md" c="dimmed">Name: {player.name}</Text>
                                        <Text size="md" c="dimmed">Race: {player.race}</Text>
                                        <Text size="md" c="dimmed">Peak League: {leagueMap[player.league]}</Text>
                                        <Text size="md" c="dimmed">Winner: {player.is_winner ? 'Yes' : 'No'}</Text>

                                        <Title order={4} size="h4" c="blue" mt="1em" mb=".5em">Build Order</Title>

                                        {player.buildOrder.length > 0 ? (
                                            <Table withBorder withColumnBorders style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Supply</th>
                                                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Time</th>
                                                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Name</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {player.buildOrder.map((order, index) => (
                                                        <tr key={index}>
                                                            <td style={{ border: '1px solid #ddd', padding: '8px' }}><Text size="md" c="dimmed">{order.supply}</Text></td>
                                                            <td style={{ border: '1px solid #ddd', padding: '8px' }}><Text size="md" c="dimmed">{order.time}</Text></td>
                                                            <td style={{ border: '1px solid #ddd', padding: '8px' }}><Text size="md" c="dimmed">{order.name}</Text></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        ) : (
                                            <Text size="md" c="dimmed">No build orders available</Text>
                                        )}
                                    </Paper>
                                </Grid.Col>
                            )
                        })}
                    </Grid>
                </div>
            )}
        </Container>
    )
}