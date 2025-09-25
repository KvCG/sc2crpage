import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { Flex } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import {
    addPositionChangeIndicator,
    type DecoratedRow,
} from '../utils/rankingHelper'
import { isValid, loadData, saveSnapShot } from '../utils/localStorage.ts'
import { getSnapshot } from '../services/api'
import { DateTime } from 'luxon'

export const Ranking = () => {
    const { data, loading, error, fetch } = useFetch('ranking')
    const [currentData, setCurrentData] = useState<DecoratedRow[] | null>(null)
    const [baseline, setBaseline] = useState<DecoratedRow[] | null>(null)

    // Remove known legacy keys from older implementations to prevent conflicts with users seeing old data.
    const clearLegacyCache = () => {
        if (typeof window === 'undefined') return
        try {
            const legacyKeys = [
                'snapShot',
                'snapshot',
                'rankingSnapshot',
                'dailySnapShot',
            ]
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

            const cached = loadData('dailySnapshot')
            if (isValid('dailySnapshot', cached)) {
                setBaseline(cached.data as DecoratedRow[])
            } else {
                // Remove invalid current cache entry (shape/version mismatch) before refilling
                try {
                    localStorage.removeItem('dailySnapshot')
                } catch {}
                try {
                    const resp = await getSnapshot()
                    const serverSnap = resp.data // { data, createdAt (CR ISO time), expiry }
                    // Format timestamp in Costa Rica time (independent of the user's system timezone)
                    const dtCR = DateTime.fromISO(
                        String(serverSnap.createdAt)
                    ).setZone('America/Costa_Rica')

                    serverSnap.createdAt = dtCR.toLocaleString(
                        DateTime.DATETIME_MED_WITH_SECONDS
                    )

                    serverSnap.expiresAt = DateTime.fromMillis(
                        serverSnap.expiry
                    )
                        .setZone('America/Costa_Rica')
                        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
                    saveSnapShot('dailySnapshot', serverSnap)

                    setBaseline(serverSnap.data as DecoratedRow[])
                } catch (e) {
                    // If snapshot fails, proceed without baseline
                    setBaseline([])
                }
            }
            fetch()
        }
        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        // When live data arrives and we have a baseline, compute indicators
        if (data && baseline !== null) {
            const finalRanking = addPositionChangeIndicator(data, baseline)
            setCurrentData(finalRanking)
        }
    }, [data, baseline])

    const renderResults = () => {
        if (error) {
            return <p>{error}</p>
        }
        if (currentData || loading) {
            return <RankingTable data={currentData} loading={loading} />
        }
        return <p>No results found.</p>
    }

    return (
        <>
            <Flex justify={'center'} direction={'column'}>
                <h1>StarCraft II Costa Rica's Top Players</h1>
                <Flex justify={'center'} style={{ paddingBottom: '10px' }}>
                    <div>
                        <IconRefresh
                            onClick={() => {
                                // Just pull data again
                                fetch()
                            }}
                            stroke={1.5}
                            style={{
                                width: '100%',
                                height: '100%',
                                padding: '5px',
                            }} // Move this to css file
                        />
                    </div>
                </Flex>
            </Flex>
            {renderResults()}
        </>
    )
}
