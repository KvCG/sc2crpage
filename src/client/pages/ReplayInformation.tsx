import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { 
    Container, 
    Loader,
    Alert,
    Tabs,
    Card,
    Group,
    Text,
    Stack
} from '@mantine/core'
import { 
    IconUser, 
    IconTrophy, 
    IconAlertCircle
} from '@tabler/icons-react'
import { 
    ReplayHeader, 
    GameDetails, 
    PlayersOverviewTab, 
    BuildOrdersTab 
} from '../components/ReplayInformation'

interface ReplayData {
    category: string
    unix_timestamp: number
    game_type: string
    region: string
    map: string
    frames: number
    frames_per_second: number
    players: Record<string, {
        name: string
        race: string
        league: number
        is_winner: boolean
        buildOrder?: Array<{
            supply: number
            time: string
            name: string
        }>
    }>
}

export const ReplayInformation = () => {
    const location = useLocation()
    const replayAnalysisFileId = location.state?.replayAnalysisFileId
    const { data: replayInformation, loading: fetchLoading, error: fetchError, fetch } = useFetch('replayAnalysis')
    const [activeTab, setActiveTab] = useState<string | null>('overview')

    useEffect(() => {
        if (replayAnalysisFileId) {
            fetch({ 'replayAnalysisFileId': replayAnalysisFileId })
        }
    }, [replayAnalysisFileId])

    const isReplayData = (data: any): data is ReplayData => {
        return data && typeof data === 'object' && 'players' in data
    }

    return (
        <Container size="xl" py="md">
            <ReplayHeader />

            {fetchLoading && (
                <Card shadow="sm" p="xl" radius="md">
                    <Group justify="center" gap="md">
                        <Loader size="lg" />
                        <Text size="lg" fw={500}>Loading replay data...</Text>
                    </Group>
                </Card>
            )}

            {fetchError && (
                <Alert 
                    icon={<IconAlertCircle size="1rem" />} 
                    title="Error Loading Replay" 
                    color="red" 
                    radius="md"
                    mb="xl"
                >
                    {fetchError}
                </Alert>
            )}

            {(!fetchLoading && !replayInformation) || (replayInformation && Object.keys(replayInformation).length === 0) ? (
                <Card shadow="sm" p="xl" radius="md">
                    <Stack align="center" gap="md">
                        <IconAlertCircle size={48} color="gray" />
                        <Text size="lg" fw={500} c="dimmed">
                            No replay information available
                        </Text>
                    </Stack>
                </Card>
            ) : null}

            {replayInformation && Object.keys(replayInformation).length !== 0 && isReplayData(replayInformation) && (
                <>
                    <GameDetails replayInformation={replayInformation} />

                    <Tabs 
                        value={activeTab} 
                        onChange={setActiveTab}
                        variant="pills"
                    >
                        <Tabs.List grow>
                            <Tabs.Tab 
                                value="overview" 
                                leftSection={<IconUser size={16} />}
                            >
                                Players Overview
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="buildorders" 
                                leftSection={<IconTrophy size={16} />}
                            >
                                Build Orders
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="overview" pt="xl">
                            <PlayersOverviewTab players={replayInformation.players} />
                        </Tabs.Panel>

                        <Tabs.Panel value="buildorders" pt="xl">
                            <BuildOrdersTab players={replayInformation.players} />
                        </Tabs.Panel>
                    </Tabs>
                </>
            )}
        </Container>
    )
}