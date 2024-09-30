import { useState } from 'react'
import { Tabs } from '@mantine/core'
import { Participants } from './Participants'
import { FilteredMatches } from './FilteredMatches'

export const TournamentTabs = ({ matches, participants, participantCount }) => {
    const [activeTab, setActiveTab] = useState<string>('participants')

    return (
        <Tabs value={activeTab} onChange={setActiveTab} keepMounted>
            <Tabs.List justify="center">
                <Tabs.Tab value="participants">
                    Mancos {`(${participantCount})`}
                </Tabs.Tab>
                <Tabs.Tab value="matches">
                    Mejengas {`(${matches.length})`}
                </Tabs.Tab>
                {/* <Tabs.Tab value="standings">Standings</Tabs.Tab> */}
            </Tabs.List>

            <br />

            <Tabs.Panel value="participants">
                <Participants participants={participants} />
            </Tabs.Panel>

            <Tabs.Panel value="matches">
                <FilteredMatches
                    matches={matches}
                    participantCount={participantCount}
                />
            </Tabs.Panel>

            {/* <Tabs.Panel value="standings">WIP</Tabs.Panel> */}
        </Tabs>
    )
}
