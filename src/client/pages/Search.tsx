import React, { useState } from 'react'
import { useFetch } from '../hooks/useFetch'

export const Search = () => {
    const [inputValue, setInputValue] = useState<string>('')
	const {data, loading, error, fetch} = useFetch()

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

	const handleClick = () => fetch(inputValue)

    const renderResults = () => {
        if (loading) {
            return <p>Loading...</p>
        }
        if (error) {
            return <p style={{ color: 'red' }}>{error}</p>
        }
        if (data?.length > 0) {
            return data.map(result => {
                const { btag, clan, id } = result
                return (
                    <div key={btag}>
                        <span>
                            {btag} - [{clan}] - {id}
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
                <button onClick={handleClick} disabled={loading}>
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
