import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { Flex} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { addPositionChangeIndicator } from '../utils/rankingHelper'
import { isValid, loadData, saveSnapShot } from '../utils/localStorage.ts'

export const Ranking = () => {
    const { data, loading, error, fetch } = useFetch('ranking')
    const [currentData, setCurrentData] = useState(data)

    useEffect(() => {
        // On mount, load snapshot if valid, else fetch
        const snapshotData = loadData('snapShot')
        if (isValid('snapShot', snapshotData)) {
            setCurrentData(snapshotData.data)
        } else {
            fetch()
        }
    }, [])

    useEffect(() => {
        // When new data arrives, compare to previous snapshot and update UI
        if (data) {
            const prevSnapshot = loadData('snapShot')
            const finalRanking = addPositionChangeIndicator(
                data,
                prevSnapshot ? prevSnapshot.data : []
            )
            const ttl = 300000 // 5 min
            const wrapper = {
                data: finalRanking,
                expiry: new Date().getTime() + ttl,
            }
            saveSnapShot('snapShot', wrapper)
            setCurrentData(finalRanking)
        }
    }, [data])

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
