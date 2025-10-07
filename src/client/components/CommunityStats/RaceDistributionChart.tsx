import { Doughnut } from 'react-chartjs-2'
import { Title, Text, Group } from '@mantine/core'
import { RaceDistribution } from '../../types/communityStats'
import { pieChartConfig } from './chartConfig'
import { CHART_THEME, getRaceColor, type RaceType } from '../../../shared/colorTokens'
import { raceAssets } from '../../constants/races'
import styles from './Charts.module.css'

interface RaceDistributionChartProps {
    data: RaceDistribution
    loading?: boolean
    error?: string
    title: string
    height?: number
}

export const RaceDistributionChart = ({ 
    data, 
    loading, 
    error, 
    title,
}: RaceDistributionChartProps) => {
    if (error) {
        return (
            <div className={styles.errorState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.errorText}>Failed to load chart data</Text>
            </div>
        )
    }

    const totalPlayers = Object.values(data.distribution).reduce((sum, count) => sum + count, 0)
    
    if (loading || totalPlayers === 0) {
        return (
            <div className={styles.loadingState}>
                <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
                <Text className={styles.loadingText}>
                    {loading ? 'Loading...' : 'No race data available'}
                </Text>
            </div>
        )
    }

    const races = Object.keys(data.distribution) as RaceType[]
    const values = races.map(race => data.distribution[race])
    const percentages = races.map(race => data.percentages[race])

    const chartData = {
        labels: races.map((race, index) => `${race} (${percentages[index]}%)`),
        datasets: [{
            data: values,
            backgroundColor: races.map(getRaceColor),
            borderColor: CHART_THEME.BACKGROUND,
            borderWidth: 1,
            hoverBorderWidth: 2,
            hoverBorderColor: CHART_THEME.HOVER_BORDER
        }]
    }

    const options = {
        ...pieChartConfig,
        cutout: '45%',
        plugins: {
            ...pieChartConfig.plugins,
            tooltip: {
                ...pieChartConfig.plugins?.tooltip,
                callbacks: {
                    label: (context: any) => {
                        const race = races[context.dataIndex]
                        const count = context.parsed
                        const percentage = percentages[context.dataIndex]
                        return `${race}: ${count.toLocaleString()} players (${percentage}%)`
                    }
                }
            }
        }
    }

    return (
        <div className={styles.chartContainer}>
            <Title order={4} c="dimmed" className={styles.chartTitle}>{title}</Title>
            
            <div className={styles.chartWrapper}>
                <Doughnut data={chartData} options={options} />
            </div>
            
            <Group className={styles.legend}>
                {races.map((race, index) => {
                    const displayRace = race.length > 8 ? `${race.slice(0, 6)}...` : race
                    return (
                        <Group key={race} className={styles.legendItem}>
                            <img 
                                src={raceAssets[race]?.assetPath} 
                                alt={race}
                                className={styles.legendIcon}
                            />
                            <Text 
                                className={styles.legendText}
                                title={`${race}: ${values[index].toLocaleString()} (${percentages[index]}%)`}
                            >
                                {displayRace}
                            </Text>
                        </Group>
                    )
                })}
            </Group>
        </div>
    )
}