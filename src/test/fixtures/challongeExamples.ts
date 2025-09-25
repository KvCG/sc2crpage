export const exampleTournamentInfo = {
    id: 100,
    name: 'CR Weekly',
    url: 'cr-weekly',
    description: 'Costa Rica community weekly',
    state: 'underway',
    progress_meter: 50,
    game_id: 123,
    participants_count: 8,
    start_at: new Date().toISOString(),
    full_challonge_url: 'https://challonge.com/cr-weekly',
    live_image_url: 'https://challonge.com/cr-weekly.png',
    sign_up_url: 'https://challonge.com/cr-weekly/signup',
    pts_for_match_win: '2',
    pts_for_match_tie: '1',
    pts_for_bye: '1',
}

export const exampleParticipant = {
    participant: {
        id: 1,
        tournament_id: 100,
        name: 'Neo',
        seed: 1,
        active: true,
        final_rank: null,
        challonge_username: 'neo',
        challonge_user_id: 111,
        attached_participatable_portrait_url: null,
        ordinal_seed: 1,
    },
}

export const exampleMatch = {
    match: {
        id: 10,
        tournament_id: 100,
        state: 'complete',
        player1_id: 1,
        player2_id: 2,
        winner_id: 1,
        loser_id: 2,
        identifier: 'A',
        round: 1,
        player1_votes: 0,
        player2_votes: 0,
        scores_csv: '2-1',
    },
}

export function buildParticipant(
    overrides?: Partial<typeof exampleParticipant.participant>
) {
    return { participant: { ...exampleParticipant.participant, ...overrides } }
}

export function buildMatch(overrides?: Partial<typeof exampleMatch.match>) {
    return { match: { ...exampleMatch.match, ...overrides } }
}
