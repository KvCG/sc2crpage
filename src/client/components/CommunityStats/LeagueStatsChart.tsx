import { Bar } from 'react-chartjs-2'
import { Title, Text, Group } from '@mantine/core'
import { LeagueDistribution } from '../../types/communityStats'
import { barChartConfig } from './chartConfig'
import { getLeagueColor, getLeagueName, getLeagueIcon, CHART_THEME } from '../../../shared/colorTokens'
import styles from './Charts.module.css'

interface LeagueStatsChartProps {
    data: LeagueDistribution
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const LeagueStatsChart = ({ data, loading, error, title }: LeagueStatsChartProps) => {
    if (error) {
        return (
            <div className={styles.errorState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.errorText}>Failed to load chart data</Text>
            </div>
        )
    }

    // Get all league IDs that have data, ensure we include all leagues 0-6 even if they have 0 players
    const allLeagueIds = ['0', '1', '2', '3', '4', '5', '6']
    const dataLeagueIds = Object.keys(data.distribution)
    const leagueIds = [...new Set([...dataLeagueIds, ...allLeagueIds])]
    
    if (loading || leagueIds.length === 0) {
        return (
            <div className={styles.loadingState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.loadingText}>
                    {loading ? 'Loading...' : 'No league data available'}
                </Text>
            </div>
        )
    }

    // Sort leagues from highest (Grandmaster) to lowest (Bronze)
    const sortedLeagueIds = leagueIds.sort((a, b) => parseInt(b) - parseInt(a))
    
    const values = sortedLeagueIds.map(id => data.distribution[id] || 0)
    const labels = sortedLeagueIds.map(getLeagueName)
    const percentages = sortedLeagueIds.map(id => data.percentages[id] || '0.00')
    
    // Filter out leagues with 0 players to keep the chart clean 
    const leaguesWithData = sortedLeagueIds.map((id, index) => ({ 
        id, 
        value: values[index], 
        label: labels[index], 
        percentage: percentages[index] 
    })).filter(league => league.value > 0)
    
    // Use filtered data for the chart (only leagues with players)
    const displayLeagueIds = leaguesWithData.map(l => l.id)
    const displayValues = leaguesWithData.map(l => l.value)
    const displayLabels = leaguesWithData.map(l => l.label)

    const chartData = {
        labels: displayLabels,
        datasets: [{
            data: displayValues,
            backgroundColor: displayLeagueIds.map(getLeagueColor),
            borderColor: displayLeagueIds.map(getLeagueColor),
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            hoverBorderWidth: 2,
            hoverBorderColor: CHART_THEME.HOVER_BORDER
        }]
    }

    const options = {
        ...barChartConfig,
        indexAxis: 'y' as const,
        scales: {
            ...barChartConfig.scales,
            x: {
                ...barChartConfig.scales?.x,
                beginAtZero: true,
            },
            y: {
                ...barChartConfig.scales?.y,
                grid: { display: false },
            },
        },
        plugins: {
            ...barChartConfig.plugins,
            tooltip: {
                ...barChartConfig.plugins?.tooltip,
                callbacks: {
                    label: (context: any) => {
                        const leagueId = displayLeagueIds[context.dataIndex]
                        const leagueName = getLeagueName(leagueId)
                        const count = context.parsed.x
                        const total = displayValues.reduce((sum, v) => sum + v, 0)
                        const percentage = ((count / total) * 100).toFixed(1)
                        return `${leagueName}: ${count.toLocaleString()} players (${percentage}%)`
                    }
                }
            }
        }
    }

    return (
        <div className={styles.chartContainer}>
            <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
            
            <div className={styles.chartWrapper}>
                <Bar data={chartData} options={options} />
            </div>
            
            <Group className={styles.legend}>
                {displayLeagueIds.map((id, index) => {
                    const leagueName = getLeagueName(id)
                    const count = displayValues[index]
                    const total = displayValues.reduce((sum, v) => sum + v, 0)
                    const percentage = ((count / total) * 100).toFixed(1)
                    return (
                        <Group key={id} className={styles.legendItem}>
                            <img 
                                src={getLeagueIcon(id)}
                                alt={leagueName}
                                className={styles.legendIcon}
                            />
                            <Text 
                                className={styles.legendText}
                                title={`${leagueName}: ${count.toLocaleString()} (${percentage}%)`}
                            >
                                {leagueName}
                            </Text>
                        </Group>
                    )
                })}
            </Group>
        </div>
    )
}