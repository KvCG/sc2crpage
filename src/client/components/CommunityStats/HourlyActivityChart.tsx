import { Line } from 'react-chartjs-2'
import { Title, Text } from '@mantine/core'
import { TemporalPatterns } from '../../types/communityStats'
import { baseChartConfig } from './chartConfig'
import { CHART_THEME } from '../../../shared/colorTokens'
import styles from './Charts.module.css'

interface HourlyActivityChartProps {
    data: TemporalPatterns | null
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const HourlyActivityChart = ({ data, loading, error, title }: HourlyActivityChartProps) => {
    if (error) {
        return (
            <div className={styles.errorState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.errorText}>Failed to load chart data</Text>
            </div>
        )
    }

    if (loading || !data || !data.hourlyDistribution) {
        return (
            <div className={styles.loadingState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.loadingText}>
                    {loading ? 'Loading...' : 'No activity pattern data available'}
                </Text>
            </div>
        )
    }

    // Generate 24-hour labels
    const hourLabels = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0')
        return `${hour}:00`
    })

    // Use the hourly distribution array (should be 24 elements)
    const activityValues = data.hourlyDistribution.length === 24 
        ? data.hourlyDistribution 
        : Array.from({ length: 24 }, (_, i) => data.hourlyDistribution[i] || 0)

    const chartData = {
        labels: hourLabels,
        datasets: [
            {
                label: 'Active Players',
                data: activityValues,
                borderColor: '#228be6', // Blue from Mantine theme
                backgroundColor: 'rgba(34, 139, 230, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#228be6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3, // Smooth curve
            },
        ],
    }

    const options = {
        ...baseChartConfig,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time of Day (Costa Rica Time)',
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
            ...baseChartConfig.plugins,
            tooltip: {
                ...baseChartConfig.plugins?.tooltip,
                callbacks: {
                    title: (context: any) => {
                        const hour = context[0].label
                        return `Time: ${hour}`
                    },
                    label: (context: any) => {
                        return `Active Players: ${context.parsed.y}`
                    },
                },
            },
        },
    }

    return (
        <div className={styles.chartContainer}>
            <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
            
            <div className={styles.chartWrapper}>
                <Line data={chartData} options={options} />
            </div>
        </div>
    )
}