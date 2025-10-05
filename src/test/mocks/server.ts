import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { exampleGroupTeamEntry, exampleCharacterSearchEntry } from '../fixtures/pulseExamples'

// Mock data for tests
const mockRankingData = [
    {
        ...exampleGroupTeamEntry,
        members: {
            ...exampleGroupTeamEntry.members,
            character: { id: 'player1' },
            account: { battleTag: 'Player1#1234' }
        }
    },
    {
        ...exampleCharacterSearchEntry,
        members: {
            ...exampleCharacterSearchEntry.members,
            character: { id: 'player2' },
            account: { battleTag: 'Player2#5678' }
        }
    }
]

const mockSeasonData = [
    {
        battlenetId: 54,
        region: 1,
        year: 2025,
        number: 1,
        start: '2025-01-01T00:00:00Z',
        end: '2025-04-01T00:00:00Z'
    }
]

const mockSearchResults = [
    {
        ...exampleCharacterSearchEntry,
        members: {
            ...exampleCharacterSearchEntry.members,
            character: { id: 'search-result-1' },
            account: { battleTag: 'SearchResult#1234' }
        }
    }
]

// Define handlers for your API endpoints
export const handlers = [
    rest.get(
        'https://sc2pulse.nephest.com/sc2/api/character/search',
        (req, res, ctx) => {
            const term = req.url.searchParams.get('term')
            // Filter mock results based on search term
            const filtered = mockSearchResults.filter(entry => 
                entry.members.account.battleTag.toLowerCase().includes((term || '').toLowerCase())
            )
            return res(ctx.json(filtered))
        }
    ),

    rest.get(
        'https://sc2pulse.nephest.com/sc2/api/season/list/all',
        (req, res, ctx) => {
            return res(ctx.json(mockSeasonData))
        }
    ),

    rest.get(
        'https://sc2pulse.nephest.com/sc2/api/group/team',
        (req, res, ctx) => {
            return res(ctx.json(mockRankingData))
        }
    ),

    // Challonge API endpoints
    rest.get(
        'https://api.challonge.com/v1/tournaments/:tournament.json',
        (req, res, ctx) => {
            const tournament = req.params.tournament
            return res(ctx.json({
                tournament: {
                    id: 12345,
                    name: `Test Tournament ${tournament}`,
                    url: String(tournament),
                    description: 'Mock tournament for tests',
                    tournament_type: 'single_elimination',
                    state: 'underway'
                }
            }))
        }
    ),

    rest.get(
        'https://api.challonge.com/v1/tournaments/:tournament/participants.json',
        (req, res, ctx) => {
            return res(ctx.json([
                {
                    participant: {
                        id: 1,
                        name: 'TestPlayer1',
                        challonge_username: 'testplayer1',
                        seed: 1
                    }
                },
                {
                    participant: {
                        id: 2,
                        name: 'TestPlayer2', 
                        challonge_username: 'testplayer2',
                        seed: 2
                    }
                }
            ]))
        }
    ),

    rest.get(
        'https://api.challonge.com/v1/tournaments/:tournament/matches.json',
        (req, res, ctx) => {
            return res(ctx.json([
                {
                    match: {
                        id: 1,
                        state: 'complete',
                        player1_id: 1,
                        player2_id: 2,
                        winner_id: 1,
                        scores_csv: '2-0'
                    }
                }
            ]))
        }
    ),

    // Replay Analyzer API endpoints
    rest.post(
        /.*analyzeReplayBase64/,
        (req, res, ctx) => {
            return res(ctx.json({
                status: 'success',
                analysis: {
                    duration: '12:34',
                    map: 'Test Map',
                    players: ['Player1', 'Player2'],
                    winner: 'Player1'
                }
            }))
        }
    ),

    rest.post(
        /.*analyzeReplayUrl/,
        (req, res, ctx) => {
            return res(ctx.json({
                status: 'success',
                analysis: {
                    duration: '15:22',
                    map: 'Another Test Map',
                    players: ['PlayerA', 'PlayerB'],
                    winner: 'PlayerB'
                }
            }))
        }
    ),
]

// Setup MSW server with the handlers
export const server = setupServer(...handlers)
