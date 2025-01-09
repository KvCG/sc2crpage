import { useState } from 'react'
import { Box, Flex, Text } from '@mantine/core'
import { raceAssets } from '../../constants/races'

export function RacesTable({ data, setTableData, loading }) {

    const [selectedRace, setSelectedRace] = useState("")

    const countRaces = (data) => {
        return data?.reduce((acc, player) => {
            if (player.race) {
                acc[player.race] = (acc[player.race] || 0) + 1
            }
            return acc
        }, {})
    }

    const raceCounts = countRaces(data || [])

    const filterRaces = (race) => {
        if (selectedRace == race) {
            setTableData(data)
            setSelectedRace("")
        } else {
            const filteredData = data.filter((player) => player.race === race)
            setSelectedRace(race)
            setTableData(filteredData)
        }
    }

    if (loading) {
        return <div>Loading...</div>
    }

    return (
        <Box>
            <Flex
                direction="row"
                gap="xl"
                wrap="wrap"
                align="center"
                justify="center"
            >
                {Object.entries(raceCounts).map(([race, count]) => (
                    <Flex
                        key={race}
                        align="center"
                        gap="0.5rem"
                    >
                        <button style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => filterRaces(race.toUpperCase())}>
                            <img
                                src={raceAssets[race.toUpperCase()].assetPath}
                                alt={`${race.toLocaleLowerCase()}`}
                                style={{ width: '36px', height: '36px' }}
                            />
                        </button>
                        <Text>
                            {count}
                        </Text>
                    </Flex>
                ))}
            </Flex>
        </Box>
    )
}
