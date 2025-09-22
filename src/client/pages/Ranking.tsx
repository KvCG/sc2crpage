import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { Flex} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { addPositionChangeIndicator, type DecoratedRow } from '../utils/rankingHelper'
import { isValid, loadData, saveSnapShot } from '../utils/localStorage.ts'
import { getSnapshot } from '../services/api'

export const Ranking = () => {
    const { data, loading, error, fetch } = useFetch('ranking')
    const [currentData, setCurrentData] = useState<DecoratedRow[] | null>(null)
    const [baseline, setBaseline] = useState<DecoratedRow[] | null>(null)

    useEffect(() => {
        // On mount: resolve baseline (daily snapshot), then fetch live ranking
        const init = async () => {
            // Cleanup legacy key to avoid conflicts with new dailySnapshot cache
            try { localStorage.removeItem('snapShot') } catch {}
            const cached = loadData('dailySnapshot')
            if (isValid('dailySnapshot', cached)) {
                setBaseline(cached.data as DecoratedRow[])
            } else {
                try {
                    const resp = await getSnapshot()
                    const serverSnap = resp.data // { data, createdAt, expiry }
                    const wrapper = { data: serverSnap.data, expiry: serverSnap.expiry }
                    saveSnapShot('dailySnapshot', wrapper)
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
                <Flex justify={'center'} style={{paddingBottom: '10px'}}>
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
