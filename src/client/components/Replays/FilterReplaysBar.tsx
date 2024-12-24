import { useState, useEffect } from 'react';
import { TextInput, Select, Flex, Space } from '@mantine/core';
import styles from './FilterReplaysBar.module.css';

export const FilterReplaysBar = ({ fetchData, setFilteredData }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [race1, setRace1] = useState('');
    const [race2, setRace2] = useState('');
    const [date, setDate] = useState('Newest first');

    useEffect(() => {
        handleFilter();
    }, [searchQuery, race1, race2, date]);

    useEffect(() => {
        handleFilter();
    }, [fetchData]);

    const handleFilter = () => {
        let filtered = fetchData;

        if (!filtered) return;

        if (searchQuery) {
            filtered = filtered.filter((replay: any) =>
                Object.values(replay).some((value: any) =>
                    value.toString().toLowerCase().includes(searchQuery.toLowerCase())
                )
            );
        }

        if (race1) {
            filtered = filtered.filter((replay: any) => replay.player1Race === race1);
        }

        if (race2) {
            filtered = filtered.filter((replay: any) => replay.player2Race === race2);
        }

        if (date) {
            filtered = filtered.sort((a: any, b: any) => {
                const dateA = new Date(a.modifiedTime);
                const dateB = new Date(b.modifiedTime);
                return date === 'Oldest first' ? dateA - dateB : dateB - dateA;
            });
        }

        setFilteredData([...filtered]);
    };

    return (
        <>
            <Space h="xl" />
            <Flex
                direction="row"
                wrap="wrap"
                justify="center"
                align="center"
                gap="md"
                className={styles.flexContainer}
            >
                <TextInput
                    placeholder="Search replays"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                    className={styles.input}
                />
                <Select
                    placeholder="Race Player 1"
                    data={['Terran', 'Protoss', 'Zerg']}
                    value={race1}
                    onChange={setRace1}
                    className={styles.input}
                />
                <Select
                    placeholder="Race Player 2"
                    data={['Terran', 'Protoss', 'Zerg']}
                    value={race2}
                    onChange={setRace2}
                    className={styles.input}
                />
                <Select
                    placeholder="Date"
                    data={['Newest first','Oldest first']}
                    value={date}
                    onChange={setDate}
                    className={styles.input}
                />
            </Flex>
        </>
    );
};