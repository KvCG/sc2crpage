import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { Box, Flex, Popover, Slider, Text } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'

export const Ranking = () => {
    const { data, loading, error, fetch } = useFetch('ranking')
    const [depth, setDepth] = useState(120)

    useEffect(() => {
        fetch(depth)
    }, [depth])

    const renderResults = () => {
        if (error) {
            return <p>{error}</p>
        }
        if (data || loading) {
            return <RankingTable data={data} loading={loading} />
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

                <Popover width={300} position="bottom" withArrow shadow="md">
                    <Popover.Target>
                        <div>
                            <IconSettings
                                style={{ width: '100%', height: '100%' }}
                                stroke={1.5}
                                height={18}
                                width={18}
                            />
                        </div>
                    </Popover.Target>
                    <Popover.Dropdown top={140}>
                        <Box maw={250} mih={50} mx="auto">
                            <Text>Top players in the last {depth} days.</Text>
                            <Slider
                                defaultValue={depth}
                                marks={marks}
                                onChangeEnd={setDepth}
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
