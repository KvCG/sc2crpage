import { useEffect } from 'react'
import { Container, Grid, Paper, LoadingOverlay, Alert, Button } from '@mantine/core'
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react'

import { usePlayerActivity } from '../hooks/usePlayerActivity'

import { HourlyActivityChart } from '../components/CommunityStats/HourlyActivityChart'
import { DailyActivityChart } from '../components/CommunityStats/DailyActivityChart'
import { ActivityBucketsChart } from '../components/CommunityStats/ActivityBucketsChart'
import { EngagementMetricsCards } from '../components/CommunityStats/EngagementMetricsChart'
import { ActivityQueryParams } from '../types/communityStats'
import classes from './CommunityStats.module.css' // Reuse existing styles

export const PlayerActivity = () => {
    const { data, loading, error, fetch, refresh } = usePlayerActivity()

    useEffect(() => {
        // Initial data fetch with default activity parameters
        const activityParams: ActivityQueryParams = {
            timeframe: 'current',
            includeInactive: true,
            minimumGames: 0,
            race: null,
            groupBy: 'activity', // Default grouping for activity analysis
        }
        fetch(activityParams)
    }, [fetch])

    const handleRefresh = () => {
        refresh()
    }

    return (
        <>
            {/* Header - matches CommunityStats page pattern */}
            <div className={classes.header}>
                <h1 className={classes.title}>Player Activity Analytics</h1>
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
                {/* Community Engagement Metrics - at the top */}
                {data && !loading && (
                    <Paper className={classes.metadataSection} withBorder mt="md">
                        <div className={classes.metadataContainer}>
                            <EngagementMetricsCards
                                data={data.engagementMetrics}
                                loading={loading}
                                error={error || undefined}
                            />
                        </div>
                    </Paper>
                )}

                {/* Error State */}
                {error && !loading && (
                    <Alert
                        icon={<IconAlertCircle size="1rem" />}
                        title="Error Loading Activity Data"
                        color="red"
                        className={classes.errorAlert}
                    >
                        {error}
                    </Alert>
                )}

                {/* Charts Grid - positioned relative for overlay */}
                <div className={classes.chartsContainer}>
                    <LoadingOverlay
                        visible={loading && !data}
                        overlayProps={{ radius: 'sm', blur: 2 }}
                    />

                    <Grid gutter="md">
                        {/* Hourly Activity Pattern - Full width */}
                        <Grid.Col span={12}>
                            <Paper className={classes.chartCard} withBorder>
                                <HourlyActivityChart
                                    data={data?.temporalPatterns || null}
                                    loading={loading}
                                    error={error || undefined}
                                    title="Activity by Hour"
                                />
                            </Paper>
                        </Grid.Col>

                        {/* Daily Activity Pattern - Half width */}
                        <Grid.Col span={12}>
                            <Paper className={classes.chartCard} withBorder>
                                <DailyActivityChart
                                    data={data?.temporalPatterns || null}
                                    loading={loading}
                                    error={error || undefined}
                                    title="Activity by Day"
                                />
                            </Paper>
                        </Grid.Col>

                        {/* Activity Buckets - Full width */}
                        <Grid.Col span={12}>
                            <Paper className={classes.chartCard} withBorder>
                                <ActivityBucketsChart
                                    data={data?.activityBuckets || null}
                                    loading={loading}
                                    error={error || undefined}
                                    title="Player Activity Timeline"
                                />
                            </Paper>
                        </Grid.Col>
                    </Grid>
                </div>
            </Container>
        </>
    )
}
