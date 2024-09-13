import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { Box, Flex, Popover, Slider, Text } from '@mantine/core'
import { IconSettings, IconRefresh } from '@tabler/icons-react'
import { loadData, isValid, saveData, saveDepth } from '../utils/localStorage'
import { addPositionChangeIndicator } from '../utils/rankingHelper'

export const Ranking = () => {
    const { data, loading, error, fetch } = useFetch('ranking')
    const [depth, setDepth] = useState(loadData('depth') || 30) // Loads depth from the localStorage if available
    const [currentData, setCurrentData] = useState(data)

    useEffect(() => {
        // This effect loads data from the localStorage if available.
        const lastRanking = loadData(depth)
        if (isValid('', lastRanking)) {
            setCurrentData(lastRanking.data)
        } else {
            fetch(depth)
        }
    }, [depth])

    useEffect(() => {
        // This effect saves data in the localStorage and set expiration time
        if (data) {
            const finalRanking = addPositionChangeIndicator(
                data,
                loadData('snapShot')?.[depth] // Loading ranking from daily snapshot, to compare against
            )
            const ttl = 300000 // 5 min
            const wrapper = {
                data: finalRanking,
                expiry: new Date().getTime() + ttl,
            }
            saveData(depth, wrapper)
            setCurrentData(finalRanking)
        }
    }, [data])

    const renderResults = () => {
        if (error) {
            return <p>{error}</p>
        }
		if (!currentData?.length) {
			return <p>Slow network, please refresh the page</p>
		}
        if (currentData || loading) {
            return <RankingTable data={currentData} loading={loading} />
        }
        return <p>No results found.</p>
    }

    const marks = [
        { value: 30, label: '30 days' },
        { value: 60, label: '60 days' },
        { value: 90, label: '90 days' },
        { value: 120, label: '120 days' },
    ]

    return (
        <>
            <Flex justify={'center'}>
                <h1>Top Players</h1>
                <div>
                    <IconRefresh
                        onClick={() => {
                            // Just pull data again
                            fetch(depth)
                        }}
                        height={20}
                        width={20}
                        stroke={1.5}
                        style={{
                            width: '100%',
                            height: '100%',
                            padding: '5px',
                            paddingTop: '20px',
                        }} // Move this to css file
                    />
                </div>

                <Popover width={300} position="bottom" withArrow shadow="md">
                    <Popover.Target>
                        <div>
                            <IconSettings
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    paddingTop: '15px',
                                }} // Move this to css file
                                stroke={1.5}
                                height={20}
                                width={20}
                            />
                        </div>
                    </Popover.Target>
                    <Popover.Dropdown top={140}>
                        <Box maw={250} mih={50} mx="auto">
                            <Text>Top players in the last {depth} days.</Text>
                            <Slider
                                defaultValue={depth}
                                marks={marks}
                                onChangeEnd={value => {
                                    setDepth(value)
                                    saveDepth('depth', value)
                                }}
                                min={30}
                                max={120}
                                step={30}
                                styles={{ markLabel: { display: 'none' } }}
                            />
                        </Box>
                    </Popover.Dropdown>
                </Popover>
            </Flex>
            {renderResults()}
        </>
    )
}
