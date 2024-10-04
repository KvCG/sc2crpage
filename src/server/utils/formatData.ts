import { addMatchCategory, getStandingsData } from './challongeHelper'
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
        tournamentId: participant.tournament_id,
        name: participant.name,
        seed: participant.seed,
        active: participant.active,
        finalRank: participant.final_rank,
        challongeUsername: participant.challonge_username,
        challongeUserId: participant.challonge_user_id,
        attachedParticipatablePortraitUrl:
            participant.attached_participatable_portrait_url,
        ordinalSeed: participant.ordinal_seed,
    }

    return slimParticipant
}

const formatTournamentData = async data => {
    if (!data) return null
    let { info, participants, matches } = data
    info = getSlimInfo(info)
    participants = await formatParticipantData(participants)
    matches = formatMatchData(matches, participants)
    const standings = getStandingsData(info, participants, matches) // We need to calculate standings based on the data the comes from challonge

    return { info, participants, matches, standings }
}

const getSlimInfo = data => {
    if (!data) return null
    const slimInfo = {
        id: data.id,
        name: data.name,
        url: data.url,
        description: data.description,
        state: data.state,
        progressMeter: data.progress_meter,
        gameId: data.game_id,
        participantsCount: data.participants_count,
        startAt: data.start_at,
        fullChallongeUrl: data.full_challonge_url,
        liveImageUrl: data.live_image_url,
        signUpUrl: data.sign_up_url,
        ptsForMatchWin: data.pts_for_match_win,
        ptsForMatchTie: data.pts_for_match_tie,
        ptsForBye: data.pts_for_bye,
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
        tournamentId: match.tournament_id,
        state: match.state,
        player1Id: match.player1_id,
        player2Id: match.player2_id,
        winnerId: match.winner_id,
        loserId: match.loser_id,
        identifier: match.identifier,
        round: match.round,
        player1Votes: match.player1_votes,
        player2Votes: match.player2_votes,
        scoresCsv: match.scores_csv,
    }
    return slimMatch
}
