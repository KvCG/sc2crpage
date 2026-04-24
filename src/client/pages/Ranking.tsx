import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { SeasonPicker } from '../components/Ranking/SeasonPicker'
import { Button, Flex, Modal, Stack, Text } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { addPositionChangeIndicator, type DecoratedRow } from '../utils/rankingHelper'
import { isValid, loadData, saveSnapShot } from '../utils/localStorage.ts'
import { getSnapshot, getSeasons } from '../services/api'
import { DateTime } from 'luxon'
import type { SeasonEntry } from '../../shared/types'

export const Ranking = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { data, loading, error, fetch } = useFetch('ranking')
    const [currentData, setCurrentData] = useState<DecoratedRow[] | null>(null)
    const [baseline, setBaseline] = useState<DecoratedRow[] | null>(null)
    const [seasons, setSeasons] = useState<SeasonEntry[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [quickViewPlayerA, setQuickViewPlayerA] = useState<{ characterId: number; displayName: string } | null>(null)

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
            } else {
                try {
                    const resp = await getSnapshot()
                    const serverSnap = resp.data // { data, createdAt (CR ISO time), expiry }
                    // Format timestamp in Costa Rica time (independent of the user's system timezone)
                    const dtCR = DateTime.fromISO(String(serverSnap.createdAt)).setZone(
                        'America/Costa_Rica'
                    )
                    serverSnap.createdAt = dtCR.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
                    serverSnap.expiresAt = DateTime.fromMillis(serverSnap.expiry)
                        .setZone('America/Costa_Rica')
                        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
                    saveSnapShot('dailySnapshot', serverSnap)
                    setBaseline(serverSnap.data as DecoratedRow[])
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
                />
            )
        }
        return <p>No results found.</p>
    }

    return (
        <>
            <Modal
                opened={quickViewPlayerA !== null}
                onClose={() => setQuickViewPlayerA(null)}
                title="H2H Quick View"
                centered
            >
                {quickViewPlayerA && (
                    <Stack>
                        <Text size="sm" c="dimmed">
                            Player A is prefilled from your ranking selection.
                        </Text>
                        <Text fw={700}>{quickViewPlayerA.displayName}</Text>
                        <Button
                            onClick={() => {
                                navigate(`/h2h?player1=${quickViewPlayerA.characterId}`)
                                setQuickViewPlayerA(null)
                            }}
                        >
                            Open H2H Launcher
                        </Button>
                    </Stack>
                )}
            </Modal>
            <Flex justify={'center'} direction={'column'}>
                <h1>StarCraft II Costa Rica's Top Players</h1>
                <Flex justify={'center'} style={{ paddingBottom: '10px' }}>
                    <div>
                        <Button
                            leftSection={<IconRefresh size={16} />}
                            variant="light"
                            onClick={() => fetch(getUrlParams())}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </div>
                </Flex>
            </Flex>
            {seasons.length > 0 && selectedSeasonId !== null && (
                <Flex justify={'center'} style={{ paddingBottom: '10px' }}>
                    <SeasonPicker
                        seasons={seasons}
                        value={selectedSeasonId}
                        onChange={handleSeasonChange}
                    />
                </Flex>
            )}
            {renderResults()}
        </>
    )
}
