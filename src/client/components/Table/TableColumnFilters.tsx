import { Button, Checkbox, Menu, SimpleGrid } from '@mantine/core'

export interface ColumnOptions {
    top: boolean
    name: boolean
    mmr: boolean
    rank: boolean
    race: boolean
    lastPlayed: boolean
    terran: boolean
    protoss: boolean
    zerg: boolean
    random: boolean
	total: boolean
}

interface ColumnSelectorProps {
    columns: ColumnOptions
    onColumnChange: (updated: ColumnOptions) => void
}

const columnItems = [
    { id: 'top', label: 'Top' },
    { id: 'name', label: 'Name' },
    { id: 'mmr', label: 'MMR' },
    { id: 'rank', label: 'Rank' },
    { id: 'race', label: 'Race' },
    { id: 'lastPlayed', label: 'Last Played' },
    { id: 'terran', label: '# Terran' },
    { id: 'protoss', label: '# Protoss' },
    { id: 'zerg', label: '# Zerg' },
    { id: 'random', label: '# Random' },
	{ id: 'total', label: 'Total games' },
]

export function RankingTableColumnFilters({
    columns,
    onColumnChange,
}: ColumnSelectorProps) {
    const handleCheckboxChange = (
        id: keyof ColumnOptions,
        checked: boolean
    ) => {
        onColumnChange({ ...columns, [id]: checked })
    }

    return (
        <Menu shadow="md" width={250}>
            <Menu.Target>
                <Button variant="outline">Select Columns To Display</Button>
            </Menu.Target>
            <Menu.Dropdown>
                <SimpleGrid
                    cols={2}
                    spacing="sm"
                    breakpoints={[{ maxWidth: 'sm', cols: 1 }]}
                >
                    {columnItems.map(item => (
                        <Checkbox
                            key={item.id}
                            label={item.label}
                            checked={columns[item.id as keyof ColumnOptions]}
                            onChange={e =>
                                handleCheckboxChange(
                                    item.id as keyof ColumnOptions,
                                    e.currentTarget.checked
                                )
                            }
                        />
                    ))}
                </SimpleGrid>
            </Menu.Dropdown>
        </Menu>
    )
}
