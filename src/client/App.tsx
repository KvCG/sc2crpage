import React, { useEffect, useState } from 'react'
import { search } from './services/getPlayerInfo.ts'
import './App.css'
import { AxiosResponse } from 'axios'
import { DataGrid, GridRowsProp, GridColDef } from '@mui/x-data-grid'
import pi from '../../mockData/PlayerInfo.json'

// Define functional component using TypeScript
const App: React.FC = () => {
    // TypeScript infers the type of `count` as number
    const [inputValue, setInputValue] = useState<string>('')
    const [playerInfo, setPlayerInfo] = useState<object[]>([])
    const [rows, setRows] = useState<GridRowsProp>([])
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement
        setInputValue(target.value)
    }

    useEffect(() => {
        playerInfo.forEach((player, index) => {
            addRow({
                id: index,
                col1: player.members.account.battleTag,
                col2: String(player.ratingMax),
            })
        })
    }, [playerInfo])

    const addRow = (newRow: { id: number; col1: string; col2: string }) => {
        setRows(prevRows => [...prevRows, newRow])
    }


    // pi.forEach((player, index)=>{
    // 	addRow({ id: index, col1: player.members.account.battleTag, col2: String(player.ratingMax)})
    // })

    // pi.map((player, i) => {
    //     addRow({ id: i, col1: player.members.account.battleTag, col2: String(player.ratingMax)})
    // })
    // const rows: GridRowsProp = [
    //     { id: 1, col1: pi[0].members.account.battleTag , col2: 'World' },
    //     { id: 2, col1: 'DataGridPro', col2: 'is Awesome' },
    //     { id: 3, col1: 'MUI', col2: 'is Amazing' },
    // ]

    const columns: GridColDef[] = [
        { field: 'col1', headerName: 'Battletag', width: 150 },
        { field: 'col2', headerName: 'Highest MMR', width: 150 },
    ]

    return (
        <>
            <h1>SC2 CR </h1>
            <div className="card">
                <input type="text" onInput={handleInput} />
                <button
                    onClick={async () => {
                        const response: AxiosResponse = await search(inputValue)
                        setPlayerInfo(response.data)
                    }}
                >
                    Search
                </button>
            </div>
            <div>
                <h2>Player Data</h2>
                {/* {JSON.stringify(playerInfo)} */}
                <div style={{ height: 300, width: '100%' }}>
                    <DataGrid rows={rows} columns={columns} />
                </div>
            </div>
        </>
    )
}

export default App
