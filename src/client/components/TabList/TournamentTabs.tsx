import { useState } from 'react'
import { Tabs } from '@mantine/core'
import { Participants } from './Participants'
import { FilteredMatches } from './FilteredMatches'
import { StandingsTable } from '../Standings/Standings'

export const TournamentTabs = ({
    matches,
    participants,
    participantCount,
    standings,
}) => {
    const [activeTab, setActiveTab] = useState<string>('matches')

    return (
        <Tabs value={activeTab} onChange={setActiveTab} keepMounted>
            <Tabs.List justify="center">
                <Tabs.Tab value="matches">
                    Mejengas {`(${matches.length})`}
                </Tabs.Tab>
				<Tabs.Tab value="standings">Standings</Tabs.Tab>
                <Tabs.Tab value="participants">
                    Mancos {`(${participantCount})`}
                </Tabs.Tab>
            </Tabs.List>

            <br />
            <Tabs.Panel value="matches">
                <FilteredMatches
                    matches={matches}
                    participantCount={participantCount}
                    participants={participants}
                />
            </Tabs.Panel>
			<Tabs.Panel value="standings">
                <StandingsTable standings={standings} />
            </Tabs.Panel>
            <Tabs.Panel value="participants">
                <Participants participants={participants} />
            </Tabs.Panel>
        </Tabs>
    )
}
