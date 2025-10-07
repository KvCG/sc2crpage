import { Bar } from 'react-chartjs-2'
import { Title, Text } from '@mantine/core'
import { RatingStatistics } from '../../types/communityStats'
import { barChartConfig } from './chartConfig'
import { ACTIVITY_COLORS } from '../../../shared/colorTokens'
import styles from './Charts.module.css'

interface RankingMovementChartProps {
    data: RatingStatistics
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const RankingMovementChart = ({
    data,
    loading,
    error,
    title,
}: RankingMovementChartProps) => {
    if (error) {
        return (
            <div className={styles.errorState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>
                    {title}
                </Title>
                <Text className={styles.errorText}>Failed to load chart data</Text>
            </div>
        )
    }

    if (loading || !data) {
        return (
            <div className={styles.loadingState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>
                    {title}
                </Title>
                <Text className={styles.loadingText}>
                    {loading ? 'Loading...' : 'No rating data available'}
                </Text>
            </div>
        )
    }

    const labels = ['AVG', 'Median', 'Min', 'Max']
    const values = [data.average, data.median, data.min, data.max]
    const colors = [
        ACTIVITY_COLORS.HIGH_ACTIVITY,
        ACTIVITY_COLORS.MODERATE_ACTIVITY,
        ACTIVITY_COLORS.LOW_ACTIVITY,
        ACTIVITY_COLORS.NO_GAMES,
    ]

    const chartData = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
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
                        return `${context.label}: ${context.parsed.y.toFixed(0)} MMR`
                    },
                },
            },
        },
        scales: {
            ...barChartConfig.scales,
            y: {
                ...barChartConfig.scales?.y,
                beginAtZero: false,
            },
        },
    }

    return (
        <div className={styles.chartContainer}>
            <Title order={4} c="dimmed" className={styles.chartTitle}>
                {title}
            </Title>

            <div className={styles.chartWrapper}>
                <Bar data={chartData} options={options} />
            </div>
        </div>
    )
}
