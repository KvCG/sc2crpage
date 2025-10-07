import { Group, Select } from '@mantine/core'
import { CommunityStatsFilters } from '../../types/communityStats'
import { RACE_OPTIONS } from './constants'
import classes from './StatsFilters.module.css'

interface StatsFiltersProps {
    filters: CommunityStatsFilters
    onChange: (filters: CommunityStatsFilters) => void
}

export const StatsFilters = ({ filters, onChange }: StatsFiltersProps) => {
    // const handleTimeframeChange = (value: string | null) => {
    //     if (value && (value === 'current' || value === 'daily')) {
    //         onChange({
    //             ...filters,
    //             timeframe: value,
    //         })
    //     }
    // }

    // const handleIncludeInactiveChange = (checked: boolean) => {
    //     onChange({
    //         ...filters,
    //         includeInactive: checked,
    //     })
    // }

    // const handleMinimumGamesChange = (value: string | number) => {
    //     const numValue = typeof value === 'string' ? parseInt(value, 10) : value
    //     if (!isNaN(numValue) && numValue >= 0) {
    //         onChange({
    //             ...filters,
    //             minimumGames: numValue,
    //         })
    //     }
    // }

    const handleRaceChange = (value: string | null) => {
        onChange({
            ...filters,
            selectedRace: value === 'all' ? null : value,
        })
    }

    return (
        <Group className={classes.filtersContainer}>
            <Select
                label="Race Filter"
                value={filters.selectedRace || 'all'}
                onChange={handleRaceChange}
                data={RACE_OPTIONS}
                w={150}
            />
        </Group>
    )

    // return (
    //     <Group className={classes.filtersContainer}>
    //         {/* <Select
    //             label="Timeframe"
    //             value={filters.timeframe}
    //             onChange={handleTimeframeChange}
    //             data={[
    //                 { value: 'current', label: 'Current' },
    //                 { value: 'daily', label: 'Daily Snapshot' },
    //             ]}
    //             w={150}
    //         /> */}

    //         <Select
    //             label="Race Filter"
    //             value={filters.selectedRace || 'all'}
    //             onChange={handleRaceChange}
    //             data={RACE_OPTIONS}
    //             w={150}
    //         />

    //         {/* <NumberInput
    //             label="Minimum Games"
    //             value={filters.minimumGames}
    //             onChange={handleMinimumGamesChange}
    //             min={MINIMUM_GAMES_LIMITS.min}
    //             max={MINIMUM_GAMES_LIMITS.max}
    //             step={MINIMUM_GAMES_LIMITS.step}
    //             w={150}
    //         /> */}

    //         {/* <Switch
    //             label="Include Inactive Players"
    //             checked={filters.includeInactive}
    //             onChange={(event) => handleIncludeInactiveChange(event.currentTarget.checked)}
    //             mt={25}
    //         /> */}
    //     </Group>
    // )
}
