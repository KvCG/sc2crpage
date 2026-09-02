import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { SeasonPicker } from '../components/Ranking/SeasonPicker'
import { Group } from '@mantine/core'
import terranBanner from '../assets/terran_banner.png'
import { addPositionChangeIndicator, type DecoratedRow } from '../utils/rankingHelper'
import { isValid, loadData, saveSnapShot } from '../utils/localStorage.ts'
import { getSnapshot, getSeasons } from '../services/api'
import { DateTime } from 'luxon'
import { formatRelativeTime } from '../utils/common'
import type { SeasonEntry } from '../../shared/types'
import classes from './Ranking.module.css'
import { PlayerQuickView } from '../components/h2h/PlayerQuickView'
import type { H2HQuickViewPlayer } from '../types/h2hQuickView'

export const Ranking = () => {
    const [searchParams] = useSearchParams()
    const { data, loading, error, fetch } = useFetch('ranking')
    const [currentData, setCurrentData] = useState<DecoratedRow[] | null>(null)
    const [baseline, setBaseline] = useState<DecoratedRow[] | null>(null)
    const [seasons, setSeasons] = useState<SeasonEntry[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [snapshotCreatedAt, setSnapshotCreatedAt] = useState<string | null>(null)
    const [quickViewPlayerA, setQuickViewPlayerA] = useState<H2HQuickViewPlayer | null>(null)

    const currentSeasonId = seasons.length > 0 ? seasons[0].id : null
    const isCurrentSeason = selectedSeasonId === null || selectedSeasonId === currentSeasonId

    // Note: Minimum games filtering is handled server-side at the pulseService.getRanking() boundary
    // URL parameters are optional for testing purposes
    const getUrlParams = () => {
        const params: Record<string, any> = {}
        const games = searchParams.get('minimumGames')

        if (games !== null) params.minimumGames = parseInt(games, 10)
        if (!isCurrentSeason && selectedSeasonId !== null) params.season = selectedSeasonId

        return Object.keys(params).length > 0 ? params : undefined
    }

    const handleSeasonChange = (id: number) => {
        setSelectedSeasonId(id)
        const isNewCurrent = seasons.length === 0 || id === seasons[0].id
        const params: Record<string, any> = {}
        const games = searchParams.get('minimumGames')
        if (games !== null) params.minimumGames = parseInt(games, 10)
        if (!isNewCurrent) params.season = id
        fetch(Object.keys(params).length > 0 ? params : undefined)
    }

    // Remove known legacy keys from older implementations to prevent conflicts with users seeing old data.
    const clearLegacyCache = () => {
        if (typeof window === 'undefined') return
        try {
            const legacyKeys = ['snapShot', 'snapshot', 'rankingSnapshot', 'dailySnapShot']
            for (const key of legacyKeys) {
                if (localStorage.getItem(key) !== null) {
                    localStorage.removeItem(key)
                }
            }
        } catch {} // Best-effort cleanup only.
    }

    useEffect(() => {
        // On mount: resolve baseline (daily snapshot), then fetch live ranking
        const init = async () => {
            // Cleanup legacy keys to avoid conflicts with the new dailySnapshot cache
            clearLegacyCache()

            // Fetch season list (stable data; no polling needed)
            try {
                const seasonsResp = await getSeasons()
                const seasonList: SeasonEntry[] = seasonsResp.data
                setSeasons(seasonList)
                if (seasonList.length > 0) {
                    setSelectedSeasonId(seasonList[0].id)
                }
            } catch {
                // Proceed without season picker if the endpoint fails
            }

            const cached = loadData('dailySnapshot')
            if (isValid('dailySnapshot', cached)) {
                setBaseline(cached.data as DecoratedRow[])
                if (typeof cached?.createdAt === 'string') {
                    setSnapshotCreatedAt(cached.createdAt)
                }
            } else {
                try {
                    const resp = await getSnapshot()
                    const serverSnap = resp.data // { data, createdAt (ISO time), expiry }
                    // Keep createdAt as the raw ISO string: the UI renders it as relative
                    // time (formatRelativeTime) and the cached copy must round-trip parseable.
                    serverSnap.createdAt = String(serverSnap.createdAt)
                    serverSnap.expiresAt = DateTime.fromMillis(serverSnap.expiry)
                        .setZone('America/Costa_Rica')
                        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
                    saveSnapShot('dailySnapshot', serverSnap)
                    setBaseline(serverSnap.data as DecoratedRow[])
                    setSnapshotCreatedAt(serverSnap.createdAt)
                } catch (e) {
                    // If snapshot fails, proceed without baseline
                    setBaseline([])
                }
            }
            fetch(getUrlParams())
        }
        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        // When live data arrives and we have a baseline, compute indicators.
        // For historical seasons there is no same-day baseline — use data directly.
        if (data && baseline !== null) {
            if (isCurrentSeason) {
                const finalRanking = addPositionChangeIndicator(data, baseline)
                setCurrentData(finalRanking)
            } else {
                setCurrentData(data as DecoratedRow[])
            }
        }
    }, [data, baseline])

    // Refetch when URL search params change (for testing)
    useEffect(() => {
        if (baseline !== null) {
            fetch(getUrlParams())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    const renderResults = () => {
        if (error) {
            return <p>{error}</p>
        }
        if (!isCurrentSeason && !loading && Array.isArray(currentData) && currentData.length === 0) {
            return <p>No players found for this season.</p>
        }
        if (currentData || loading) {
            return (
                <RankingTable
                    data={currentData}
                    loading={loading}
                    onOpenH2HQuickView={(player) => setQuickViewPlayerA(player)}
                    onRefresh={() => fetch(getUrlParams())}
                    refreshLoading={loading}
                />
            )
        }
        return <p>No results found.</p>
    }

    const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null
    const playerCount = currentData?.length ?? 0
    const topMmr =
        currentData && currentData.length > 0
            ? Math.max(...currentData.map((row) => Number(row.rating) || 0))
            : null

    return (
        <>
            <PlayerQuickView
                opened={quickViewPlayerA !== null}
                player={quickViewPlayerA}
                onClose={() => setQuickViewPlayerA(null)}
            />
            <section className={classes.hero}>
                <img src={terranBanner} alt="" className={classes.banner} />
                <div className={classes.content}>
                    <div className={classes.columns}>
                        <div>
                            <div className={classes.kicker}>
                                <span className={classes.kickerBar} aria-hidden />
                                {selectedSeason ? `LADDER · SEASON ${selectedSeason.number}` : 'LADDER'}
                            </div>
                            <h1 className={classes.title}>StarCraft II Costa Rica's Top Players</h1>
                            <p className={classes.subtitle}>
                                Live 1v1 ladder standings for the Costa Rican StarCraft II community, pulled from SC2Pulse.
                            </p>
                        </div>
                        <dl className={classes.stats}>
                            <div className={classes.stat}>
                                <dt className={classes.statLabel}>Players</dt>
                                <dd className={classes.statValue}>{playerCount}</dd>
                            </div>
                            {topMmr !== null && (
                                <div className={classes.stat}>
                                    <dt className={classes.statLabel}>Top MMR</dt>
                                    <dd className={classes.statValue}>{topMmr}</dd>
                                </div>
                            )}
                            {snapshotCreatedAt !== null && (
                                <div className={classes.stat}>
                                    <dt className={classes.statLabel}>Updated</dt>
                                    <dd className={classes.statValue}>
                                        {formatRelativeTime(snapshotCreatedAt)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                    <Group gap="sm" className={classes.toolbar}>
                        {seasons.length > 0 && selectedSeasonId !== null && (
                            <SeasonPicker
                                seasons={seasons}
                                value={selectedSeasonId}
                                onChange={handleSeasonChange}
                            />
                        )}
                    </Group>
                </div>
            </section>
            {renderResults()}
        </>
    )
}
