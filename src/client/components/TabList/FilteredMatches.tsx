import { useState } from 'react'
import { Flex } from '@mantine/core'
import { MatchFilters } from './MatchFilters'
import { RoundHeader } from './RoundHeader'
import { Match } from '../Match/Match'
import { calculateRounds } from '../../utils/common'

export const FilteredMatches = ({ matches, participantCount }) => {
    const [selectedRound, setSelectedRound] = useState<number | null>(null)
    const [selectedState, setSelectedState] = useState<string | null>(null)

    const rounds = calculateRounds(participantCount)
    const actualRounds = Array.from({ length: rounds }, (_, index) => index + 1)
    const matchStates = ['pending', 'ongoing', 'complete']

    const filterMatches = matches => {
        return matches.filter(match => {
            const roundMatches =
                selectedRound !== null ? match.round === selectedRound : true
            const stateMatches =
                selectedState !== null ? match.state === selectedState : true
            return roundMatches && stateMatches
        })
    }

    const filteredMatches = filterMatches(matches)
    let actualRound = 1

    return (
        <Flex direction="column" gap="sm" rowGap={1}>
            <MatchFilters
                rounds={actualRounds}
                matchStates={matchStates}
                onRoundChange={setSelectedRound}
                onStateChange={setSelectedState}
            />

            <Flex direction="row" justify={'center'} wrap="wrap" gap="xs">
                {filteredMatches.map((match, index) => {
                    match.number = index + 1
                    let render = <Match key={match.id} match={match} />

                    if (index % rounds === 0) {
                        render = (
                            <>
                                <RoundHeader key={`h-${actualRound}`}
                                    round={selectedRound || actualRound}
                                />
                                <Match key={`m-${actualRound}`} match={match} />
                            </>
                        )
                        actualRound += 1
                    }

                    return render
                })}
            </Flex>
        </Flex>
    )
}
