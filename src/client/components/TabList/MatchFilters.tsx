import { Select, Flex } from '@mantine/core'

export const MatchFilters = ({
    rounds,
    matchStates,
    onRoundChange,
    onStateChange,
}) => {
    return (
        <Flex gap="sm" justify="center">
            <Select
                label="Select Round"
                placeholder="Select a round"
                data={rounds.map(round => ({
                    value: round.toString(),
                    label: `Jornada ${round}`,
                }))}
                onChange={value =>
                    onRoundChange(value ? parseInt(value) : null)
                }
                clearable
            />

            <Select
                label="Select Match State"
                placeholder="Select a state"
                data={matchStates.map(state => ({
                    value: state,
                    label: state.charAt(0).toUpperCase() + state.slice(1),
                }))}
                onChange={onStateChange}
                clearable
            />
        </Flex>
    )
}
