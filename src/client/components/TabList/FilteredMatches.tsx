import { useState } from 'react'
import { Flex, Tooltip } from '@mantine/core'
import { MatchFilters } from './MatchFilters'
import { RoundHeader } from './RoundHeader'
import { Match } from '../Match/Match'
import { calculateRounds } from '../../utils/common'

export const FilteredMatches = ({
    matches,
    participantCount,
    participants,
}) => {
    const [selectedRound, setSelectedRound] = useState<number | null>(null)
    const [selectedState, setSelectedState] = useState<string | null>(null)
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
    const [premierOnly, setPremierOnly] = useState<boolean>(false)

    const rounds = calculateRounds(participantCount) // Debe devolver 24 para 25 jugadores
    const actualRounds = Array.from({ length: rounds }, (_, index) => index + 1)
    const matchStates = ['open', 'complete']

    // Filtrar partidos según la ronda y el estado
    const filterMatches = matches => {
        return matches.filter(match => {
            const playerMatches =
                selectedPlayer !== null
                    ? match.player1_id.toString() === selectedPlayer ||
                      match.player2_id.toString() === selectedPlayer
                    : true
            const roundMatches =
                selectedRound !== null ? match.round === selectedRound : true
            const stateMatches =
                selectedState !== null ? match.state === selectedState : true
            const premierMatches = premierOnly
                ? match.isClose || match.isPremier
                : true
            return (
                roundMatches && stateMatches && playerMatches && premierMatches
            )
        })
    }

    const filteredMatches = filterMatches(matches)

    return (
        <Flex direction="column" gap="sm" rowGap={1}>
            <MatchFilters
                participants={participants}
                rounds={actualRounds}
                matchStates={matchStates}
                onRoundChange={setSelectedRound}
                onStateChange={setSelectedState}
                onPlayerChange={setSelectedPlayer}
                onCategoryChange={setPremierOnly}
            />
            <br />
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
                                {roundMatches.map(match =>
                                    match.isClose || match.isPremier ? (
                                        <Tooltip label = 'Buenos pichazos!'>
                                            <Match
                                                key={match.id}
                                                match={match}
                                            />
                                        </Tooltip>
                                    ) : (
                                        <Match key={match.id} match={match} />
                                    )
                                )}
                            </>
                        )
                    }
                    return null // No renderizar si no hay partidos para esta ronda
                })}
            </Flex>
        </Flex>
    )
}
