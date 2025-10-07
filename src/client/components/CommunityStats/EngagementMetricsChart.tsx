import { Text, Group, Card, Stack, ThemeIcon } from '@mantine/core'
import { IconUsers, IconDeviceGamepad2, IconChartBar, IconTrendingUp } from '@tabler/icons-react'
import { EngagementMetrics } from '../../types/communityStats'

interface EngagementMetricsCardsProps {
    data: EngagementMetrics | null
    loading?: boolean
    error?: string
}

export const EngagementMetricsCards = ({ data, loading, error }: EngagementMetricsCardsProps) => {
    if (error) {
        return (
            <Text c="red" ta="center">
                Failed to load engagement metrics
            </Text>
        )
    }

    if (loading || !data) {
        return (
            <Text c="dimmed" ta="center">
                {loading ? 'Loading engagement metrics...' : 'No engagement data available'}
            </Text>
        )
    }

    const metrics = [
        {
            label: 'Total Games',
            value: data.totalGames.toLocaleString(),
            icon: IconDeviceGamepad2,
            color: 'blue'
        },
        {
            label: 'Active Players',
            value: data.activePlayers.toString(),
            icon: IconUsers,
            color: 'green'
        },
        {
            label: 'Avg Games/Player',
            value: Math.round(data.averageGamesPerActivePlayer).toString(),
            icon: IconChartBar,
            color: 'orange'
        },

        // Not sure if this metric makes sense
        // { 
        //     label: 'Engagement Rate',
        //     value: `${data.engagementRate}%`,
        //     icon: IconTrendingUp,
        //     color: 'grape'
        // }
    ]

    return (
        <Group justify="center" gap="md" wrap="wrap">
            {metrics.map((metric) => (
                <Card
                    key={metric.label}
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    style={{ minWidth: 200 }}
                >
                    <Stack align="center" gap="xs">
                        <ThemeIcon
                            size="xl"
                            radius="xl"
                            variant="light"
                            color={metric.color}
                        >
                            <metric.icon size={24} />
                        </ThemeIcon>
                        
                        <Text size="xl" fw={700} c={metric.color}>
                            {metric.value}
                        </Text>
                        
                        <Text size="sm" c="dimmed" ta="center">
                            {metric.label}
                        </Text>
                    </Stack>
                </Card>
            ))}
        </Group>
    )
}