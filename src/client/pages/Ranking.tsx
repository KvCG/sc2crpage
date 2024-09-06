import { useEffect } from "react";
import { useFetch } from "../hooks/useFetch"
import { RankingTable } from "../components/Table/Table";

export const Ranking = () => {
	const {data, loading, error, fetch} = useFetch('ranking')

	useEffect(() => {
		fetch()
	}, []);
	
    const renderResults = () => {
        if (error) {
            return <p>{error}</p>
        }
        if (data || loading) {
            return <RankingTable data={data} loading={loading}/>
        }
        return <p>No results found.</p>
    }

    return (
        <div>
            <h1>Top Players</h1>
            {renderResults()}
        </div>
    )
}
