import { addMatchCategory } from './matchHelper'
import {
    filterByHighestRatingLast,
    verifyChallongeParticipant,
    verifyPlayer,
} from './userDataHelper'

export const formatData = async (data, type) => {
    let formattedData = []
    switch (type) {
        case 'search': {
            formattedData = formatSearchData(data)
            break
        }
        case 'ranking': {
            formattedData = await formatRankingData(data)
            break
        }
        case 'tournament': {
            formattedData = await formatTournamentData(data)
            break
        }
    }

    return formattedData
}

const simplifyPlayerData = data => {
    let players = []
    data.forEach(current => {
        const {
            leagueMax,
            ratingMax,
            totalGamesPlayed,
            currentStats,
            members,
        } = current
        const id = members.character.id
        const btag = members.account.battleTag
        const clan = members?.clan?.tag
        const terranGamesPlayed = members.terranGamesPlayed ?? 1
        const zergGamesPlayed = members.zergGamesPlayed ?? 0
        const protossGamesPlayed = members.protossGamesPlayed ?? 0

        const player = {
            leagueMax,
            ratingMax,
            totalGamesPlayed,
            ...currentStats,
            terranGamesPlayed,
            protossGamesPlayed,
            zergGamesPlayed,
            id,
            btag,
            clan,
        }

        players.push(player)
    })

    return players
}

const formatSearchData = data => {
    let players = simplifyPlayerData(data)

    return players
}

const formatRankingData = async data => {
    if (!data) return null
    data = await Promise.all(
        data?.map(async data => {
            const verifiedPlayerData = await verifyPlayer(data)
            return verifiedPlayerData
        })
    )

    data = filterByHighestRatingLast(data)
    return data.sort((a, b) => b.ratingLast - a.ratingLast)
}

const formatParticipantData = async data => {
    if (!data) return null

    let crossReferenceData = await Promise.all(
        data?.map(async ({ participant }) => {
            const verifiedPlayerData = await verifyChallongeParticipant(
                getSlimParticipant(participant)
            )
            return verifiedPlayerData
        })
    )

    return crossReferenceData
}

const getSlimParticipant = participant => {
    if (!participant) return null

    const slimParticipant = {
        id: participant.id,
        tournament_id: participant.tournament_id,
        name: participant.name,
        seed: participant.seed,
        active: participant.active,
        final_rank: participant.final_rank,
        challonge_username: participant.challonge_username,
        challonge_user_id: participant.challonge_user_id,
        attached_participatable_portrait_url:
            participant.attached_participatable_portrait_url,
        ordinal_seed: participant.ordinal_seed,
    }

    return slimParticipant
}

const formatTournamentData = async data => {
    if (!data) return null
    let { info, participants, matches } = data
    info = getSlimInfo(info)
    participants = await formatParticipantData(participants)
    matches = formatMatchData(matches, participants)

    return { info, participants, matches }
}

const getSlimInfo = data => {
    if (!data) return null
    const slimInfo = {
        id: data.id,
        name: data.name,
        url: data.url,
        description: data.description,
        state: data.state,
        progress_meter: data.progress_meter,
        game_id: data.game_id,
        participants_count: data.participants_count,
        start_at: data.start_at,
        full_challonge_url: data.full_challonge_url,
        live_image_url: data.live_image_url,
        sign_up_url: data.sign_up_url,
    }

    return slimInfo
}

const formatMatchData = (matches, participants) => {
    if (!matches || !participants) return null
    return matches?.map(({ match }, index) => {
		match.number = index + 1
        let slimMatch = getSlimMatch(match)
		slimMatch = addMatchCategory(slimMatch, participants)
        return slimMatch
    })
}

const getSlimMatch = match => {
    if (!match) return null
    const slimMatch = {
        id: match.id,
		number: match.number,
        tournament_id: match.tournament_id,
        state: match.state,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        winner_id: match.winner_id,
        loser_id: match.loser_id,
        identifier: match.identifier,
        round: match.round,
        player1_votes: match.player1_votes,
        player2_votes: match.player2_votes,
        scores_csv: match.scores_csv,
    }
    return slimMatch
}
