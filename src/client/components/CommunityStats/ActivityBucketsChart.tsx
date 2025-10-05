import { Bar } from 'react-chartjs-2'
import { Title, Text } from '@mantine/core'
import { ActivityBuckets } from '../../types/communityStats'
import { barChartConfig } from './chartConfig'
import { CHART_THEME } from '../../../shared/colorTokens'
import styles from './Charts.module.css'

interface ActivityBucketsChartProps {
    data: ActivityBuckets | null
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const ActivityBucketsChart = ({ data, loading, error, title }: ActivityBucketsChartProps) => {
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
                    {loading ? 'Loading...' : 'No activity bucket data available'}
                </Text>
            </div>
        )
    }

    // Prepare activity bucket data
    const bucketLabels = ['Very Recent', 'Recent', 'Today', 'Yesterday', 'This Week', 'Older']
    const bucketValues = [
        data.veryRecent,
        data.recent,
        data.today,
        data.yesterday,
        data.thisWeek,
        data.older,
    ]

    // Color scheme based on recency (newer = more vibrant)
    const bucketColors = [
        '#37b24d', // Very recent - bright green
        '#51cf66', // Recent - green
        '#69db7c', // Today - light green
        '#fab005', // Yesterday - yellow
        '#fd7e14', // This week - orange
        '#868e96', // Older - gray
    ]

    const total = bucketValues.reduce((sum, val) => sum + val, 0)

    const chartData = {
        labels: bucketLabels,
        datasets: [
            {
                label: 'Players',
                data: bucketValues,
                backgroundColor: bucketColors,
                borderColor: bucketColors,
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
                    text: 'Activity Recency',
                    color: CHART_THEME.TEXT_COLOR,
                },
                grid: {
                    color: CHART_THEME.GRID_COLOR,
                },
                ticks: {
                    color: CHART_THEME.AXIS_TEXT,
                    maxRotation: 45,
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Number of Players',
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
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
                        return `${context.label}: ${value} players (${percentage}%)`
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