import React, { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import {
    Loader,
    TextInput,
    Button,
    Group,
    Table,
    TableData,
} from '@mantine/core'

export const Search = () => {
    const [inputValue, setInputValue] = useState<string>('')
    const { data, loading, error, fetch } = useFetch('search')

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    const handleClick = () => fetch(inputValue)

    const arrayData = data?.map(player => {
        const { clan, btag, id } = player
        const slimPlayer = [id, btag, clan]
        return slimPlayer
    })

    const tableData: TableData = {
        // caption: 'Some elements from periodic table',
        head: ['CharID', 'Btag', 'Clan'],
        body: arrayData,
    }

    const renderResults = () => {
        if (loading) {
            return <Loader color="green" />
        }
        if (error) {
            return <p style={{ color: 'red' }}>{error}</p>
        }
        if (data?.length > 0) {
            return <Table stickyHeader highlightOnHover highlightOnHoverColor='dark' verticalSpacing={''} data={tableData} maw={350} miw={250} />
        }
        return <p>No results found.</p>
    }

    return (
        <>
            <h1></h1>
            <Group justify="center">
                <TextInput
                    label="Search"
                    onChange={handleInput}
                    value={inputValue}
                    placeholder="ABCDE#12345"
                    miw={250}
                    maw={400}
                />

                <Button
                    onClick={handleClick}
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
                    loading={loading}
                    top={12}
                >
                    Search
                </Button>
            </Group>
            <h2>Results for "{inputValue}"</h2>
            <Group justify="center">{renderResults()}</Group>
        </>
    )
}
