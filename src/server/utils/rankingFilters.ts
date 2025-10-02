export function getRankingMinGamesThreshold(): number {
    const raw = Number(process.env.RANKING_MIN_GAMES ?? 10)
    return Number.isFinite(raw) && raw >= 0 ? raw : 10
}

export function isValidRankingRow(row: any): boolean {
    return (
        Number.isFinite(row?.rating) &&
        Number.isFinite(row?.leagueType) &&
        typeof row?.mainRace === 'string'
    )
}

export function filterRankingForDisplay<T = any>(rows: T[] | null | undefined): T[] {
    if (!Array.isArray(rows)) return []
    const valid = rows.filter(isValidRankingRow)
    const minGames = getRankingMinGamesThreshold()
    const active = valid.filter((row: any) => {
        const total = Number(row?.totalGames ?? 0)
        return Number.isFinite(total) && total >= minGames
    })
    return active.length > 0 ? active : (valid.length > 0 ? valid : rows)
}
