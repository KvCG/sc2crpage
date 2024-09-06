import cx from 'clsx'
import { useState } from 'react'
import { Table, ScrollArea, Skeleton } from '@mantine/core'
import classes from './Table.module.css'

export function RankingTable({ data, loading }) {
    const [scrolled, setScrolled] = useState(false)
    const rows = data?.map((row, index) => {
        if (row.ratingLast) {
            return (
                <Table.Tr key={index + 1}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{row.btag}</Table.Td>
                    <Table.Td>{row.ratingLast}</Table.Td>
                    <Table.Td>{row.race}</Table.Td>
                </Table.Tr>
            )
        }
    })

    return (
        <Skeleton h={1000} visible={loading}>
            <Table
                verticalSpacing={'4'}
                stickyHeader
                striped
                highlightOnHover
                maw={1000}
                miw={250}
            >
                <Table.Thead
                    className={cx(classes.header, {
                        [classes.scrolled]: scrolled,
                    })}
                >
                    <Table.Tr>
                        <Table.Th>Ranking</Table.Th>
                        <Table.Th>Btag</Table.Th>
                        <Table.Th>Current MMR</Table.Th>
                        <Table.Th>Race</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
            </Table>
        </Skeleton>
    )
}
