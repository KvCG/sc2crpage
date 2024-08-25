import React, { useState } from 'react'
import { search } from './services/getPlayerInfo.ts'
import './App.css'
import { AxiosResponse } from 'axios'

// Define functional component using TypeScript
const App: React.FC = () => {
    // TypeScript infers the type of `count` as number
    const [inputValue, setInputValue] = useState<string>('')
    const [playerInfo, setPlayerInfo] = useState<object[]>([])
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement
		setInputValue(target.value)
    }

    return (
        <>
            <h1>SC2 CR </h1>
            <div className="card">
                <input
                    type="text"
                    onInput={handleInput}
                />
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
                {JSON.stringify(playerInfo)}
            </div>
        </>
    )
}

export default App
