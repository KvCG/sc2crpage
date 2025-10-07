import { Bar } from 'react-chartjs-2'
import { Title, Text } from '@mantine/core'
import { TemporalPatterns } from '../../types/communityStats'
import { barChartConfig } from './chartConfig'
import { CHART_THEME } from '../../../shared/colorTokens'
import styles from './Charts.module.css'

interface DailyActivityChartProps {
    data: TemporalPatterns | null
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const DailyActivityChart = ({ data, loading, error, title }: DailyActivityChartProps) => {
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

    if (loading || !data || !data.dailyDistribution) {
        return (
            <div className={styles.loadingState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>
                    {title}
                </Title>
                <Text className={styles.loadingText}>
                    {loading ? 'Loading...' : 'No daily activity data available'}
                </Text>
            </div>
        )
    }

    // Days of week (Sunday = 0, Saturday = 6)
    const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Use the daily distribution array (should be 7 elements)
    const dailyValues =
        data.dailyDistribution.length === 7
            ? data.dailyDistribution
            : Array.from({ length: 7 }, (_, i) => data.dailyDistribution[i] || 0)

    // Highlight peak day with different color
    const colors = dailyValues.map(
        (_, index) => (index === data.peakDay ? '#40c057' : '#228be6') // Green for peak, blue for others
    )

    const chartData = {
        labels: dayLabels,
        datasets: [
            {
                label: 'Active Players',
                data: dailyValues,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                hoverBorderWidth: 2,
                hoverBorderColor: CHART_THEME.HOVER_BORDER,
            },
        ],
    }

    const options = {
        ...barChartConfig,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Day of Week',
                    color: CHART_THEME.TEXT_COLOR,
                },
                grid: {
                    color: CHART_THEME.GRID_COLOR,
                },
                ticks: {
                    color: CHART_THEME.AXIS_TEXT,
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Active Players',
                    color: CHART_THEME.TEXT_COLOR,
                },
                grid: {
                    color: CHART_THEME.GRID_COLOR,
                },
                ticks: {
                    color: CHART_THEME.AXIS_TEXT,
                },
                beginAtZero: true,
            },
        },
        plugins: {
            ...barChartConfig.plugins,
            tooltip: {
                ...barChartConfig.plugins?.tooltip,
                callbacks: {
                    label: (context: any) => {
                        const value = context.parsed.y
                        const isPeak = context.dataIndex === data.peakDay
                        return `${context.label}: ${value} players${isPeak ? ' (Peak Day)' : ''}`
                    },
                },
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

            {/* Peak day indicator */}
            <Text size="sm" c="dimmed" ta="center" mt="xs">
                Peak Day: {dayLabels[data.peakDay]} • Peak Hour: {data.peakHour}:00
            </Text>
        </div>
    )
}
