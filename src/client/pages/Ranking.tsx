import { useEffect } from "react";
import { useFetch } from "../hooks/useFetch"

export const Ranking = () => {
	const {data, loading, error, fetch} = useFetch('ranking')

	useEffect(() => {
		fetch()
	}, []);
	
    const renderResults = () => {
        if (loading) {
            return <p>Loading...</p>
        }
        if (error) {
            return <p>{error}</p>
        }
        if (data) {
			console.log(data)
            return JSON.stringify(data)
        }
        return <p>No results found.</p>
    }

    return (
        <div>
            <h1>Top Players CR</h1>
            {renderResults()}
        </div>
    )
}
