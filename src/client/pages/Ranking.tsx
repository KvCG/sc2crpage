import { useEffect, useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'
import { Box, Checkbox, Slider, Text } from '@mantine/core'

export const Ranking = () => {
    const { data, loading, error, fetch } = useFetch('ranking')
    const [depth, setDepth] = useState(120)
    const [showSlider, setShowSlider] = useState(false)

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
            <h1>Top Players</h1>
            <Checkbox
                checked={showSlider}
                onChange={event => setShowSlider(event.currentTarget.checked)}
				label="Change depth"
            />
            {showSlider && (
                <Box maw={200} mx="auto">
                    <Text>Change depth in days:</Text>
                    <Slider
                        defaultValue={120}
                        marks={marks}
                        onChangeEnd={setDepth}
                        min={30}
                        max={120}
                        step={30}
                        // styles={{ markLabel: { display: 'none' } }}
                    />
                </Box>
            )}

            {renderResults()}
        </>
    )
}
