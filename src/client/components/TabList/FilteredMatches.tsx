import { useState } from 'react'
import { Flex } from '@mantine/core'
import { MatchFilters } from './MatchFilters'
import { RoundHeader } from './RoundHeader'
import { Match } from '../Match/Match'
import { calculateRounds } from '../../utils/common'

export const FilteredMatches = ({ matches, participantCount }) => {
    const [selectedRound, setSelectedRound] = useState<number | null>(null)
    const [selectedState, setSelectedState] = useState<string | null>(null)

    const rounds = calculateRounds(participantCount) // Debe devolver 24 para 25 jugadores
    const actualRounds = Array.from({ length: rounds }, (_, index) => index + 1)
    const matchStates = ['pending', 'ongoing', 'complete']

    // Filtrar partidos según la ronda y el estado
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

    return (
        <Flex direction="column" gap="sm" rowGap={1}>
            <MatchFilters
                rounds={actualRounds}
                matchStates={matchStates}
                onRoundChange={setSelectedRound}
                onStateChange={setSelectedState}
            />

            <Flex direction="row" justify="center" wrap="wrap" gap="xs">
                {actualRounds.map(round => {
                    // Filtrar partidos para la ronda actual
                    const roundMatches = filteredMatches.filter(
                        match => match.round === round
                    )

                    // Solo renderizar si hay partidos para la ronda
                    if (roundMatches.length > 0) {
                        return (
                            <>
                                <RoundHeader round={round} />
                                {roundMatches.map(match => (
                                    <Match key={match.id} match={match} />
                                ))}
                            </>
                        )
                    }
                    return null // No renderizar si no hay partidos para esta ronda
                })}
            </Flex>
        </Flex>
    )
}
