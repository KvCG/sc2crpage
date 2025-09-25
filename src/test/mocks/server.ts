import { rest } from 'msw'
import { setupServer } from 'msw/node'

// Mock data for tests
const mockRankingData = {
    // Add mock data structure that matches your API response
}

// Define handlers for your API endpoints
export const handlers = [
    rest.get(
        'https://sc2pulse.nephest.com/sc2/api/character/search',
        (req, res, ctx) => {
            const term = req.url.searchParams.get('term')
            return res(
                ctx.json([
                    // Add mock search results
                ])
            )
        }
    ),

    rest.get(
        'https://sc2pulse.nephest.com/sc2/api/season/list/all',
        (req, res, ctx) => {
            return res(ctx.json([{ battlenetId: '12345' }]))
        }
    ),

    rest.get(
        'https://sc2pulse.nephest.com/sc2/api/group/team',
        (req, res, ctx) => {
            return res(
                ctx.json([
                    // Add mock team stats
                ])
            )
        }
    ),
]

// Setup MSW server with the handlers
export const server = setupServer(...handlers)
