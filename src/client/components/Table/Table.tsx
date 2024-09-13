import { Table, Skeleton } from '@mantine/core'
import classes from './Table.module.css'
import cx from 'clsx'
import { getLeagueSrc } from '../../utils/rankingHelper'

export function RankingTable({ data, loading }) {
    const rows = data?.map((row, index) => {
        if (row.ratingLast) {
            const {
                btag,
                ratingLast,
                race,
                leagueTypeLast,
                positionChangeIndicator,
                name,
            } = row
            return (
                <Table.Tr key={btag}>
                    <Table.Td
                        className={classes.posIndicator}
                        data-content={positionChangeIndicator}
                    >
                        {positionChangeIndicator}
                    </Table.Td>
                    <Table.Td className={classes.top}>{index + 1}</Table.Td>
                    <Table.Td title={btag}>
                        {name ? name : btag.split('#')[0]}
                    </Table.Td>
                    <Table.Td>{ratingLast}</Table.Td>
                    <Table.Td>
                        <img
                            className={classes.rank}
                            src={getLeagueSrc(leagueTypeLast)}
                        ></img>
                    </Table.Td>
                    <Table.Td
                        className={cx('', {
                            [classes.zerg]: race == 'ZERG',
                            [classes.terran]: race == 'TERRAN',
                            [classes.protoss]: race == 'PROTOSS',
                            [classes.random]: race == 'RANDOM',
                        })}
                    >
                        {/* First letter cooler */}
                        {race[0]}
                    </Table.Td>
                </Table.Tr>
            )
        }
    })

    if (!loading && !data?.length)
        return <p>Slow network, please refresh the page.</p>

    return (
        <Skeleton
            className={classes.skeleton}
            h={1000}
            visible={loading}
            maw={700}
            miw={250}
        >
            <Table
                verticalSpacing={'3'}
                striped
                stickyHeader
                highlightOnHover
                stripedColor="dark"
                maw={700}
                miw={250}
            >
                <Table.Thead className={classes.header}>
                    <Table.Tr>
                        <Table.Th></Table.Th>
                        <Table.Th>Top</Table.Th>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>MMR</Table.Th>
                        <Table.Th>Rank</Table.Th>
                        <Table.Th>Race</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
            </Table>
        </Skeleton>
    )
}
