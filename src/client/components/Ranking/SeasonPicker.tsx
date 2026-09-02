import { Select } from '@mantine/core'
import type { SeasonEntry } from '../../../shared/types'

interface SeasonPickerProps {
    seasons: SeasonEntry[]
    value: number
    onChange: (id: number) => void
}

const formatLabel = (season: SeasonEntry, isCurrent: boolean): string => {
    const base = `Season ${season.id} · ${season.year} S${season.number}`
    return isCurrent ? `${base} (Current)` : base
}

export const SeasonPicker = ({ seasons, value, onChange }: SeasonPickerProps) => {
    if (seasons.length === 0) return null

    const selectOptions = seasons.map((season, index) => ({
        value: String(season.id),
        label: formatLabel(season, index === 0),
    }))

    return (
        <Select
            data={selectOptions}
            value={String(value)}
            onChange={(selected) => { if (selected !== null) onChange(Number(selected)) }}
            aria-label="Select season"
            width={280}
        />
    )
}
