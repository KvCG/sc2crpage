import { useState } from 'react'
import { Table, Skeleton, Grid, Text } from '@mantine/core'
import classes from './Table.module.css'
import cx from 'clsx'
import { getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getStandardName } from '../../utils/common'
import { RacesTable } from '../RaceTable/RacesTable'

export function RankingTable({ data, loading }) {

    const [tableData, setTableData] = useState(data)

    const rows = tableData?.map((row, index) => {
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
                        {getStandardName(row)}
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
                            [raceAssets[race]?.className]: true,
                        })}
                    >
                        {/* Iterate each image in their respective player */}
                        <img
                            className={classes.rank}
                            src={raceAssets[race]?.assetPath}
                            alt={race}
                        />
                    </Table.Td>
                </Table.Tr>
            )
        }
    })

    if (!loading && !tableData?.length)
        return <p>Sc2Pulse is failing to respond, please refresh the page.</p>

    return (
    <Grid 
        gutter='md'
    >
        <Grid.Col span={12}>
            {!loading && tableData?.length &&
                <Text align="center" mb="md">
                    Select a race to filter the table. Click the same race twice to remove the filter.
                </Text>
            }
            <RacesTable data={data} setTableData={setTableData} loading={loading} />
        </Grid.Col>

        <Skeleton
            className={classes.skeleton}
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
    </Grid>
    )
}
