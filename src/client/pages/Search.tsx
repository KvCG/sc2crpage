import React, { useState } from 'react'
import { search } from '../services/api'
import { AxiosResponse } from 'axios'

type PlayerInfo = {
    btag: string
    clan: string
}

export const Search = () => {
    const [inputValue, setInputValue] = useState<string>('')
    const [playerInfo, setPlayerInfo] = useState<PlayerInfo[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    const handleSearch = async () => {
        setLoading(true)
        setError(null)
        try {
            const response: AxiosResponse<PlayerInfo[]> = await search(
                inputValue
            )
            setPlayerInfo(response.data ?? [])
        } catch (error) {
            console.error('Error fetching player info:', error)
            setError('Failed to fetch data. Please try again later.')
            setPlayerInfo([])
        } finally {
            setLoading(false)
        }
    }

    const renderResults = () => {
        if (loading) {
            return <p>Loading...</p>
        }
        if (error) {
            return <p style={{ color: 'red' }}>{error}</p>
        }
        if (playerInfo.length > 0) {
            return playerInfo.map(result => {
                const { btag, clan } = result
                return (
                    <div key={btag}>
                        <span>
                            {btag} - [{clan}]
                        </span>
                        <br />
                    </div>
                )
            })
        }
        return <p>No results found.</p>
    }

    return (
        <>
            <h1>SC2 CR</h1>
            <div className="card">
                <input type="text" onChange={handleInput} value={inputValue} />
                <button onClick={handleSearch} disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>
            <div>
                <h2>Results for "{inputValue}"</h2>
                {renderResults()}
            </div>
        </>
    )
}
