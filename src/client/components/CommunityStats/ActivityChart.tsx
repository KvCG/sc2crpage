import { Bar } from 'react-chartjs-2'
import { Title, Text } from '@mantine/core'
import { GameActivity } from '../../types/communityStats'
import { barChartConfig } from './chartConfig'
import { ACTIVITY_COLORS, CHART_THEME } from '../../../shared/colorTokens'
import styles from './Charts.module.css'

interface ActivityChartProps {
    data: GameActivity
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const ActivityChart = ({ data, loading, error, title }: ActivityChartProps) => {
    if (error) {
        return (
            <div className={styles.errorState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.errorText}>Failed to load chart data</Text>
            </div>
        )
    }

    if (loading || !data) {
        return (
            <div className={styles.loadingState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.loadingText}>
                    {loading ? 'Loading...' : 'No activity data available'}
                </Text>
            </div>
        )
    }

    // Prepare activity distribution data
    const activityLabels = ['No Games', 'Low Activity', 'Moderate Activity', 'High Activity']
    const activityValues = [
        data.activityDistribution.noGames,
        data.activityDistribution.lowActivity,
        data.activityDistribution.moderateActivity,
        data.activityDistribution.highActivity,
    ]

    const activityColors = [
        ACTIVITY_COLORS.NO_GAMES,
        ACTIVITY_COLORS.LOW_ACTIVITY,
        ACTIVITY_COLORS.MODERATE_ACTIVITY,
        ACTIVITY_COLORS.HIGH_ACTIVITY,
    ]

    const chartData = {
        labels: activityLabels,
        datasets: [
            {
                label: 'Players',
                data: activityValues,
                backgroundColor: activityColors,
                borderColor: activityColors,
                borderWidth: 1,
                hoverBorderWidth: 2,
                hoverBorderColor: CHART_THEME.HOVER_BORDER,
            },
        ],
    }

    const options = {
        ...barChartConfig,
        plugins: {
            ...barChartConfig.plugins,
            tooltip: {
                ...barChartConfig.plugins?.tooltip,
                callbacks: {
                    label: (context: any) => {
                        const totalPlayers = activityValues.reduce((sum, val) => sum + val, 0)
                        const percentage = totalPlayers > 0 
                            ? ((context.parsed.y / totalPlayers) * 100).toFixed(1) 
                            : '0.0'
                        return `${context.label}: ${context.parsed.y} players (${percentage}%)`
                    },
                },
            },
        },
    }

    return (
        <div className={styles.chartContainer}>
            <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
            
            <div className={styles.chartWrapper}>
                <Bar data={chartData} options={options} />
            </div>
        </div>
    )
}
