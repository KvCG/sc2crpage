import cx from 'clsx'
import { useState } from 'react'
import { Table, ScrollArea, Container } from '@mantine/core'
import classes from './Table.module.css'

export function RankingTable(data) {
    const [scrolled, setScrolled] = useState(false)
    console.log(data.data)
    const rows = data.data.map((row, index) => {
        if (row.currentSeason.rating) {
            return (
                <Table.Tr key={index + 1}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{row.btag}</Table.Td>
                    <Table.Td>{row.currentSeason.rating}</Table.Td>
                </Table.Tr>
            )
        }
    })

    console.log(rows)

    return (
        <Container>
            <ScrollArea
                h={400}
                onScrollPositionChange={({ y }) => setScrolled(y !== 0)}
            >
                <Table maw={1000} miw={700}>
                    <Table.Thead
                        className={cx(classes.header, {
                            [classes.scrolled]: scrolled,
                        })}
                    >
                        <Table.Tr className=''>
                            <Table.Th>Ranking</Table.Th>
                            <Table.Th>Btag</Table.Th>
                            <Table.Th>Current MMR</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rows}</Table.Tbody>
                </Table>
            </ScrollArea>
        </Container>
    )
}
