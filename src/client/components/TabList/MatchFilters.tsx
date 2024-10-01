import { Select, Flex, Checkbox} from '@mantine/core'
import { getStandardName } from '../../utils/common'

export const MatchFilters = ({
    rounds,
    matchStates,
    participants,
    onRoundChange,
    onStateChange,
    onPlayerChange,
    onCategoryChange,
}) => {
    const alphaSortedParticipants = participants.sort((a, b) =>
        getStandardName(a).localeCompare(getStandardName(b))
    )
    return (
        <Flex gap="sm" justify="space-evenly" align={'center'} wrap={'wrap'}>
            <Select
                label="Select Player"
                placeholder="Select a player"
                data={alphaSortedParticipants.map(participant => ({
                    value: participant.id.toString(),
                    label: getStandardName(participant),
                }))}
                onChange={id => onPlayerChange(id ? id : null)}
                clearable
                searchable
            />

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
                label="Select State"
                placeholder="Select a state"
                data={matchStates.map(state => ({
                    value: state,
                    label: state.charAt(0).toUpperCase() + state.slice(1),
                }))}
                onChange={onStateChange}
                clearable
            />

            <Checkbox
                onChange={event =>
                    onCategoryChange(event.currentTarget.checked)
                }
                label="Premier Matches Only"
            />
        </Flex>
    )
}
