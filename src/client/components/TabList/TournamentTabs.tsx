import { useState } from 'react'
import { Tabs } from '@mantine/core'
import { Participants } from './Participants'

export const TournamentTabs = ({ matches, participants, participantCount }) => {
    const [activeTab, setActiveTab] = useState<string | null>('participants')

    return (
        <Tabs value={activeTab} onChange={setActiveTab} keepMounted>
            <Tabs.List justify="center">
                <Tabs.Tab value="participants">Participants {`(${participantCount})`}</Tabs.Tab>
                <Tabs.Tab value="matches">Matches</Tabs.Tab>
                <Tabs.Tab value="standings">Standings</Tabs.Tab>
            </Tabs.List>
            <br />
            <Tabs.Panel value="participants">
                <Participants participants={participants} />
            </Tabs.Panel>
            <Tabs.Panel value="matches">WIP</Tabs.Panel>
            <Tabs.Panel value="standings">WIP</Tabs.Panel>
        </Tabs>
    )
}
