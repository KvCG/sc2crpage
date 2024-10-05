import { Table } from '@mantine/core'
import { getStandardName } from '../../utils/common'
import classes from './Standings.module.css'
import { raceAssets } from '../../constants/races'

export const StandingsTable = ({ standings }) => {
    const rows = standings.map((row, index) => {
        const {
            id,
            gamesPlayed,
            wins,
            losses,
            points,
            race,
            gamesLeft,
        } = row

        return (
            <Table.Tr key={id}>
                <Table.Td>{index + 1}</Table.Td>

                <Table.Td className={classes.jugador}>
                    {getStandardName(row)}
                    <img
                        className={classes.race}
                        src={raceAssets[race]?.assetPath}
                        alt={race}
                    />
                </Table.Td>
                <Table.Td>{gamesPlayed}</Table.Td>
                <Table.Td>
                    {wins} - {losses}
                </Table.Td>
                <Table.Td>{points}</Table.Td>
            </Table.Tr>
        )
    })

    return (
        <Table
            verticalSpacing={'3'}
            striped
            stickyHeader
            highlightOnHover
            stripedColor="dark"
        >
            <Table.Thead className={classes.header}>
                <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Jugador</Table.Th>
                    <Table.Th>Jugado</Table.Th>
                    <Table.Th>W - L</Table.Th>
                    <Table.Th>Pts</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
        </Table>
    )
}
