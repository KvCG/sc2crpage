import { useEffect, useState } from 'react'
import {
    Container,
    Title,
    Text,
    Grid,
    Paper,
    LoadingOverlay,
    Alert,
    Button,
    Badge,
    Card,
} from '@mantine/core'
import { IconRefresh, IconAlertCircle, IconChartBar } from '@tabler/icons-react'
import { DateTime } from 'luxon'
import { useCommunityStats } from '../hooks/useCommunityStats'
import { StatsFilters } from '../components/CommunityStats/StatsFilters'
import { StatsMetadata } from '../components/CommunityStats/StatsMetadata'
import { ActivityChart } from '../components/CommunityStats/ActivityChart'
import { RaceDistributionChart } from '../components/CommunityStats/RaceDistributionChart'
import { LeagueStatsChart } from '../components/CommunityStats/LeagueStatsChart'
import { RankingMovementChart } from '../components/CommunityStats/RankingMovementChart'
import { CommunityStatsFilters } from '../types/communityStats'
import { DEFAULT_FILTERS } from '../components/CommunityStats/constants'
import classes from './CommunityStats.module.css'

export const CommunityStats = () => {
    const [filters, setFilters] = useState<CommunityStatsFilters>(DEFAULT_FILTERS)

    const { data, loading, error, lastUpdated, fetch, refresh } = useCommunityStats()

    useEffect(() => {
        // Initial data fetch
        fetch({
            timeframe: filters.timeframe,
            includeInactive: filters.includeInactive,
            minimumGames: filters.minimumGames,
            race: filters.selectedRace,
        })
    }, [fetch, filters])

    const handleRefresh = () => {
        refresh()
    }

    const handleFiltersChange = (newFilters: CommunityStatsFilters) => {
        setFilters(newFilters)
    }

    return (
        <>
            {/* Header - matches Ranking page pattern */}
            <div className={classes.header}>
                <h1 className={classes.title}>StarCraft II Costa Rica Community Stats</h1>
                <div className={classes.actions}>
                    <Button
                        leftSection={<IconRefresh size={16} />}
                        variant="light"
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <Container size="xl" py={0}>
                {/* Filters - more compact */}
                <Paper className={classes.filtersSection} withBorder>
                    <div className={classes.filtersContainer}>
                        <StatsFilters filters={filters} onChange={handleFiltersChange} />
                    </div>
                </Paper>

                {data && !loading && (
                    <Paper className={classes.metadataSection} withBorder mt="md">
                        <div className={classes.metadataContainer}>
                            <Card
                                shadow="sm"
                                padding="lg"
                                radius="md"
                                withBorder
                                style={{ minWidth: 200 }}
                            >
                                <Text size="xl" fw={700}>
                                    Total players: {data.metadata.totalPlayers ?? 0}
                                </Text>
                            </Card>
                        </div>
                    </Paper>
                )}
                {/* Error State */}
                {error && !loading && (
                    <Alert
                        className={classes.errorAlert}
                        icon={<IconAlertCircle size={16} />}
                        title="Error loading community stats"
                        color="red"
                    >
                        {error}
                        <div className={classes.errorActions}>
                            <Button variant="light" size="xs" onClick={handleRefresh}>
                                Try Again
                            </Button>
                        </div>
                    </Alert>
                )}

                {/* Charts Grid - improved spacing and sizing */}
                <Grid className={classes.chartsGrid}>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper className={classes.chartPaper} withBorder>
                            <LoadingOverlay visible={loading} className={classes.loadingOverlay} />
                            <div className={classes.chartContainer}>
                                <ActivityChart
                                    data={
                                        data?.gameActivity || {
                                            totalGames: 0,
                                            averageGames: 0,
                                            activityDistribution: {
                                                noGames: 0,
                                                lowActivity: 0,
                                                moderateActivity: 0,
                                                highActivity: 0,
                                            },
                                        }
                                    }
                                    loading={loading}
                                    error={error || undefined}
                                    title="Activity Distribution"
                                    height={320}
                                />
                            </div>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper className={classes.chartPaper} withBorder>
                            <LoadingOverlay visible={loading} className={classes.loadingOverlay} />
                            <div className={classes.chartContainer}>
                                <RaceDistributionChart
                                    data={
                                        data?.raceDistribution || {
                                            distribution: {
                                                TERRAN: 0,
                                                PROTOSS: 0,
                                                ZERG: 0,
                                                RANDOM: 0,
                                            },
                                            percentages: {
                                                TERRAN: '0',
                                                PROTOSS: '0',
                                                ZERG: '0',
                                                RANDOM: '0',
                                            },
                                            totalGamesPlayed: 0,
                                            gamesByRace: {
                                                TERRAN: 0,
                                                PROTOSS: 0,
                                                ZERG: 0,
                                                RANDOM: 0,
                                            },
                                        }
                                    }
                                    loading={loading}
                                    error={error || undefined}
                                    title="Race Distribution"
                                    height={320}
                                />
                            </div>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper className={classes.chartPaper} withBorder>
                            <LoadingOverlay visible={loading} className={classes.loadingOverlay} />
                            <div className={classes.chartContainer}>
                                <LeagueStatsChart
                                    data={
                                        data?.leagueDistribution || {
                                            distribution: {},
                                            percentages: {},
                                        }
                                    }
                                    loading={loading}
                                    error={error || undefined}
                                    title="League Distribution"
                                    height={320}
                                />
                            </div>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper className={classes.chartPaper} withBorder>
                            <LoadingOverlay visible={loading} className={classes.loadingOverlay} />
                            <div className={classes.chartContainer}>
                                <RankingMovementChart
                                    data={
                                        data?.ratingStatistics || {
                                            average: 0,
                                            median: 0,
                                            min: 0,
                                            max: 0,
                                            standardDeviation: 0,
                                        }
                                    }
                                    loading={loading}
                                    error={error || undefined}
                                    title="Rating Statistics"
                                    height={320}
                                />
                            </div>
                        </Paper>
                    </Grid.Col>
                </Grid>

                {/* Empty State */}
                {!data && !loading && !error && (
                    <Paper withBorder>
                        <div className={classes.emptyState}>
                            <IconChartBar className={classes.emptyIcon} />
                            <Title order={3} className={classes.emptyTitle}>
                                No Data Available
                            </Title>
                            <Text className={classes.emptyDescription}>
                                Community stats are not available at the moment. Please try again
                                later.
                            </Text>
                            <div className={classes.emptyActions}>
                                <Button onClick={handleRefresh}>Try Loading Data</Button>
                            </div>
                        </div>
                    </Paper>
                )}
            </Container>
        </>
    )
}
