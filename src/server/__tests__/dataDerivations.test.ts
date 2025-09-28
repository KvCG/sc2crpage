import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import {
    RaceExtractor,
    OnlineStatusCalculator,
    PositionCalculator,
    TeamStatsAggregator,
    DataDerivationsService,
    type PlayerMember,
    type TeamStats,
    type RankingPlayer
} from '../services/dataDerivations'

describe('RaceExtractor', () => {
    describe('extractRace', () => {
        it('should extract race from raceGames object', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                raceGames: { TERRAN: 50, PROTOSS: 10, ZERG: 5 }
            }

            expect(RaceExtractor.extractRace(member)).toBe('TERRAN')
        })

        it('should fallback to individual race fields', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                terranGamesPlayed: 5,
                protossGamesPlayed: 30,
                zergGamesPlayed: 15
            }

            expect(RaceExtractor.extractRace(member)).toBe('PROTOSS')
        })

        it('should return null for empty member', () => {
            expect(RaceExtractor.extractRace(null as any)).toBeNull()
        })

        it('should return null when no race data available', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' }
            }

            expect(RaceExtractor.extractRace(member)).toBeNull()
        })

        it('should handle random race selection', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                raceGames: { RANDOM: 25, TERRAN: 5 }
            }

            expect(RaceExtractor.extractRace(member)).toBe('RANDOM')
        })
    })

    describe('getGamesPerRace', () => {
        it('should get games from raceGames object', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                raceGames: { TERRAN: 30, PROTOSS: 20, ZERG: 10 }
            }

            const result = RaceExtractor.getGamesPerRace(member)
            expect(result).toEqual({
                TERRAN: 30,
                PROTOSS: 20,
                ZERG: 10,
                RANDOM: 0
            })
        })

        it('should fallback to individual fields', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                terranGamesPlayed: 15,
                protossGamesPlayed: 25,
                randomGamesPlayed: 5
            }

            const result = RaceExtractor.getGamesPerRace(member)
            expect(result).toEqual({
                TERRAN: 15,
                PROTOSS: 25,
                ZERG: 0,
                RANDOM: 5
            })
        })

        it('should return zeros when no data available', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' }
            }

            const result = RaceExtractor.getGamesPerRace(member)
            expect(result).toEqual({
                TERRAN: 0,
                PROTOSS: 0,
                ZERG: 0,
                RANDOM: 0
            })
        })
    })

    describe('getTotalGames', () => {
        it('should calculate total from wins/losses/ties', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                wins: 45,
                losses: 30,
                ties: 2
            }

            expect(RaceExtractor.getTotalGames(member)).toBe(77)
        })

        it('should handle missing game counts', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' },
                wins: 20
            }

            expect(RaceExtractor.getTotalGames(member)).toBe(20)
        })

        it('should return 0 for no game data', () => {
            const member: PlayerMember = {
                character: { id: 'test-id' }
            }

            expect(RaceExtractor.getTotalGames(member)).toBe(0)
        })
    })
})

describe('OnlineStatusCalculator', () => {
    const testTime = DateTime.fromISO('2024-01-15T12:00:00.000Z')

    describe('isPlayerOnline', () => {
        it('should return true for recent activity (within 24 hours)', () => {
            const recentTime = testTime.minus({ hours: 12 }).toISO()
            expect(OnlineStatusCalculator.isPlayerOnline(recentTime, testTime)).toBe(true)
        })

        it('should return false for old activity (over 24 hours)', () => {
            const oldTime = testTime.minus({ hours: 36 }).toISO()
            expect(OnlineStatusCalculator.isPlayerOnline(oldTime, testTime)).toBe(false)
        })

        it('should return false for null timestamp', () => {
            expect(OnlineStatusCalculator.isPlayerOnline(null, testTime)).toBe(false)
        })

        it('should return false for invalid timestamp', () => {
            expect(OnlineStatusCalculator.isPlayerOnline('invalid-date', testTime)).toBe(false)
        })

        it('should handle exactly 24 hours ago', () => {
            const exactTime = testTime.minus({ hours: 24 }).toISO()
            expect(OnlineStatusCalculator.isPlayerOnline(exactTime, testTime)).toBe(true)
        })
    })

    describe('getHoursSinceLastActivity', () => {
        it('should calculate hours correctly', () => {
            const pastTime = testTime.minus({ hours: 6 }).toISO()
            expect(OnlineStatusCalculator.getHoursSinceLastActivity(pastTime, testTime)).toBe(6)
        })

        it('should return null for invalid timestamp', () => {
            expect(OnlineStatusCalculator.getHoursSinceLastActivity('invalid', testTime)).toBeNull()
        })

        it('should return null for null timestamp', () => {
            expect(OnlineStatusCalculator.getHoursSinceLastActivity(null, testTime)).toBeNull()
        })
    })

    describe('getActivityStatus', () => {
        it('should return online for very recent activity', () => {
            const recentTime = testTime.minus({ minutes: 30 }).toISO()
            expect(OnlineStatusCalculator.getActivityStatus(recentTime, testTime)).toBe('online')
        })

        it('should return recent for activity within 24 hours', () => {
            const recentTime = testTime.minus({ hours: 12 }).toISO()
            expect(OnlineStatusCalculator.getActivityStatus(recentTime, testTime)).toBe('recent')
        })

        it('should return inactive for old activity', () => {
            const oldTime = testTime.minus({ days: 2 }).toISO()
            expect(OnlineStatusCalculator.getActivityStatus(oldTime, testTime)).toBe('inactive')
        })

        it('should return unknown for null timestamp', () => {
            expect(OnlineStatusCalculator.getActivityStatus(null, testTime)).toBe('unknown')
        })
    })
})

describe('PositionCalculator', () => {
    const currentRanking: RankingPlayer[] = [
        { playerCharacterId: '1', btag: 'Player1#1234', race: 'TERRAN', ratingLast: 3500, leagueTypeLast: 'DIAMOND', gamesThisSeason: 50, gamesPerRace: {}, lastDatePlayed: null, online: false },
        { playerCharacterId: '2', btag: 'Player2#5678', race: 'PROTOSS', ratingLast: 3400, leagueTypeLast: 'DIAMOND', gamesThisSeason: 45, gamesPerRace: {}, lastDatePlayed: null, online: false },
        { playerCharacterId: '3', btag: 'Player3#9012', race: 'ZERG', ratingLast: 3300, leagueTypeLast: 'PLATINUM', gamesThisSeason: 40, gamesPerRace: {}, lastDatePlayed: null, online: false }
    ]

    const previousRanking: RankingPlayer[] = [
        { playerCharacterId: '2', btag: 'Player2#5678', race: 'PROTOSS', ratingLast: 3450, leagueTypeLast: 'DIAMOND', gamesThisSeason: 40, gamesPerRace: {}, lastDatePlayed: null, online: false },
        { playerCharacterId: '1', btag: 'Player1#1234', race: 'TERRAN', ratingLast: 3400, leagueTypeLast: 'DIAMOND', gamesThisSeason: 45, gamesPerRace: {}, lastDatePlayed: null, online: false },
        { playerCharacterId: '3', btag: 'Player3#9012', race: 'ZERG', ratingLast: 3300, leagueTypeLast: 'PLATINUM', gamesThisSeason: 35, gamesPerRace: {}, lastDatePlayed: null, online: false }
    ]

    describe('calculatePositionChanges', () => {
        it('should calculate correct position changes', () => {
            const changes = PositionCalculator.calculatePositionChanges(currentRanking, previousRanking)

            expect(changes.get('Player1#1234')).toEqual({
                currentPosition: 0,
                previousPosition: 1,
                positionChangeIndicator: 'up'
            })

            expect(changes.get('Player2#5678')).toEqual({
                currentPosition: 1,
                previousPosition: 0,
                positionChangeIndicator: 'down'
            })

            expect(changes.get('Player3#9012')).toEqual({
                currentPosition: 2,
                previousPosition: 2,
                positionChangeIndicator: 'none'
            })
        })

        it('should handle new players', () => {
            const newPlayerRanking = [...currentRanking, {
                playerCharacterId: '4',
                btag: 'NewPlayer#1111',
                race: 'RANDOM' as const,
                ratingLast: 3200,
                leagueTypeLast: 'PLATINUM',
                gamesThisSeason: 25,
                gamesPerRace: {},
                lastDatePlayed: null,
                online: false
            }]

            const changes = PositionCalculator.calculatePositionChanges(newPlayerRanking, previousRanking)

            expect(changes.get('NewPlayer#1111')).toEqual({
                currentPosition: 3,
                positionChangeIndicator: 'none'
            })
        })
    })

    describe('addPositionChangeIndicators', () => {
        it('should add position indicators to ranking data', () => {
            const withIndicators = PositionCalculator.addPositionChangeIndicators(currentRanking, previousRanking)

            expect(withIndicators[0].positionChangeIndicator).toBe('up')      // Player1 moved up
            expect(withIndicators[1].positionChangeIndicator).toBe('down')    // Player2 moved down
            expect(withIndicators[2].positionChangeIndicator).toBe('none')    // Player3 same position
        })
    })

    describe('getMovementStatistics', () => {
        it('should calculate movement statistics', () => {
            const changes = PositionCalculator.calculatePositionChanges(currentRanking, previousRanking)
            const stats = PositionCalculator.getMovementStatistics(changes)

            expect(stats).toEqual({
                up: 1,      // Player1 moved up
                down: 1,    // Player2 moved down
                unchanged: 1, // Player3 stayed same
                new: 0      // No new players in this test
            })
        })

        it('should count new players correctly', () => {
            const newPlayerRanking = [...currentRanking, {
                playerCharacterId: '4',
                btag: 'NewPlayer#1111',
                race: 'RANDOM' as const,
                ratingLast: 3200,
                leagueTypeLast: 'PLATINUM',
                gamesThisSeason: 25,
                gamesPerRace: {},
                lastDatePlayed: null,
                online: false
            }]

            const changes = PositionCalculator.calculatePositionChanges(newPlayerRanking, previousRanking)
            const stats = PositionCalculator.getMovementStatistics(changes)

            expect(stats.new).toBe(1)
        })
    })
})

describe('TeamStatsAggregator', () => {
    const teamStats: TeamStats[] = [
        {
            members: [{ character: { id: 'char1' }, wins: 20, losses: 10 }],
            rating: 3500,
            league: { type: 'DIAMOND' },
            lastPlayed: '2024-01-15T10:00:00.000Z'
        },
        {
            members: [{ character: { id: 'char1' }, wins: 15, losses: 8 }],
            rating: 3300,
            league: { type: 'PLATINUM' },
            lastPlayed: '2024-01-14T15:00:00.000Z'
        },
        {
            members: [{ character: { id: 'char2' }, wins: 25, losses: 12 }],
            rating: 3600,
            league: { type: 'DIAMOND' },
            lastPlayed: '2024-01-15T12:00:00.000Z'
        }
    ]

    describe('groupStatsByCharacterId', () => {
        it('should group teams by character ID', () => {
            const grouped = TeamStatsAggregator.groupStatsByCharacterId(teamStats)

            expect(grouped.get('char1')).toHaveLength(2)
            expect(grouped.get('char2')).toHaveLength(1)
            expect(grouped.get('char1')?.[0].rating).toBe(3500)
            expect(grouped.get('char1')?.[1].rating).toBe(3300)
        })

        it('should handle empty team stats', () => {
            const grouped = TeamStatsAggregator.groupStatsByCharacterId([])
            expect(grouped.size).toBe(0)
        })
    })

    describe('getHighestRatingTeam', () => {
        it('should return team with highest rating', () => {
            const char1Teams = teamStats.filter(team => 
                team.members.some(member => member.character.id === 'char1')
            )

            const highest = TeamStatsAggregator.getHighestRatingTeam(char1Teams)
            expect(highest?.rating).toBe(3500)
        })

        it('should return null for empty array', () => {
            const highest = TeamStatsAggregator.getHighestRatingTeam([])
            expect(highest).toBeNull()
        })
    })

    describe('getMostRecentActivity', () => {
        it('should return most recent timestamp', () => {
            const char1Teams = teamStats.filter(team => 
                team.members.some(member => member.character.id === 'char1')
            )

            const mostRecent = TeamStatsAggregator.getMostRecentActivity(char1Teams)
            // Compare as DateTime objects to handle timezone conversions
            const expected = DateTime.fromISO('2024-01-15T10:00:00.000Z')
            const actual = mostRecent ? DateTime.fromISO(mostRecent) : null
            
            expect(actual?.toMillis()).toBe(expected.toMillis())
        })

        it('should return null for empty array', () => {
            const mostRecent = TeamStatsAggregator.getMostRecentActivity([])
            expect(mostRecent).toBeNull()
        })
    })

    describe('aggregatePlayerStats', () => {
        it('should aggregate stats from multiple teams', () => {
            const char1Teams = teamStats.filter(team => 
                team.members.some(member => member.character.id === 'char1')
            )

            const stats = TeamStatsAggregator.aggregatePlayerStats('char1', char1Teams)

            expect(stats.playerCharacterId).toBe('char1')
            expect(stats.ratingLast).toBe(3500)  // Highest rating team
            expect(stats.leagueTypeLast).toBe('DIAMOND')
            expect(stats.gamesThisSeason).toBe(30)  // 20+10 from highest rating team
            
            // Compare timestamps as DateTime objects to handle timezone conversions
            const expectedTime = DateTime.fromISO('2024-01-15T10:00:00.000Z')
            const actualTime = stats.lastDatePlayed ? DateTime.fromISO(stats.lastDatePlayed) : null
            expect(actualTime?.toMillis()).toBe(expectedTime.toMillis())
        })

        it('should handle character with no teams', () => {
            const stats = TeamStatsAggregator.aggregatePlayerStats('nonexistent', [])

            expect(stats.playerCharacterId).toBe('nonexistent')
            expect(stats.ratingLast).toBeNull()
            expect(stats.gamesThisSeason).toBe(0)
            expect(stats.online).toBe(false)
        })
    })
})

describe('DataDerivationsService', () => {
    const mockTeamStats: TeamStats[] = [
        {
            members: [{
                character: { id: 'char1' },
                raceGames: { TERRAN: 30, PROTOSS: 5 },
                wins: 20,
                losses: 15,
                ties: 0
            }],
            rating: 3500,
            league: { type: 'DIAMOND' },
            lastPlayed: '2024-01-15T10:00:00.000Z'
        },
        {
            members: [{
                character: { id: 'char2' },
                raceGames: { PROTOSS: 25, ZERG: 10 },
                wins: 18,
                losses: 12,
                ties: 1
            }],
            rating: 3400,
            league: { type: 'DIAMOND' },
            lastPlayed: '2024-01-15T08:00:00.000Z'
        }
    ]

    const mockCsvData = [
        { id: 'char1', btag: 'Player1#1234', name: 'Player One' },
        { id: 'char2', btag: 'Player2#5678', name: 'Player Two' }
    ]

    describe('processTeamStatsToRanking', () => {
        it('should process team stats into ranking format', () => {
            const ranking = DataDerivationsService.processTeamStatsToRanking(mockTeamStats, mockCsvData)

            expect(ranking).toHaveLength(2)
            
            // Should be sorted by rating (highest first)
            expect(ranking[0].ratingLast).toBe(3500)
            expect(ranking[1].ratingLast).toBe(3400)

            // Check derived data
            expect(ranking[0].race).toBe('TERRAN')
            expect(ranking[0].btag).toBe('Player1#1234')
            expect(ranking[0].gamesThisSeason).toBe(35) // 20+15+0

            expect(ranking[1].race).toBe('PROTOSS')
            expect(ranking[1].btag).toBe('Player2#5678')
            expect(ranking[1].gamesThisSeason).toBe(31) // 18+12+1
        })

        it('should handle empty team stats', () => {
            const ranking = DataDerivationsService.processTeamStatsToRanking([], [])
            expect(ranking).toHaveLength(0)
        })

        it('should work without CSV data', () => {
            const ranking = DataDerivationsService.processTeamStatsToRanking(mockTeamStats)

            expect(ranking).toHaveLength(2)
            expect(ranking[0].btag).toBeUndefined()
            expect(ranking[0].name).toBeUndefined()
        })
    })

    describe('filterByMinimumGames', () => {
        it('should filter players by minimum games', () => {
            const ranking: RankingPlayer[] = [
                { playerCharacterId: '1', race: 'TERRAN', ratingLast: 3500, leagueTypeLast: 'DIAMOND', gamesThisSeason: 50, gamesPerRace: {}, lastDatePlayed: null, online: false },
                { playerCharacterId: '2', race: 'PROTOSS', ratingLast: 3400, leagueTypeLast: 'DIAMOND', gamesThisSeason: 15, gamesPerRace: {}, lastDatePlayed: null, online: false }
            ]

            const filtered = DataDerivationsService.filterByMinimumGames(ranking, 20)
            expect(filtered).toHaveLength(1)
            expect(filtered[0].gamesThisSeason).toBe(50)
        })

        it('should use default minimum of 20 games', () => {
            const ranking: RankingPlayer[] = [
                { playerCharacterId: '1', race: 'TERRAN', ratingLast: 3500, leagueTypeLast: 'DIAMOND', gamesThisSeason: 25, gamesPerRace: {}, lastDatePlayed: null, online: false },
                { playerCharacterId: '2', race: 'PROTOSS', ratingLast: 3400, leagueTypeLast: 'DIAMOND', gamesThisSeason: 15, gamesPerRace: {}, lastDatePlayed: null, online: false }
            ]

            const filtered = DataDerivationsService.filterByMinimumGames(ranking)
            expect(filtered).toHaveLength(1)
            expect(filtered[0].gamesThisSeason).toBe(25)
        })
    })

    describe('getRankingStatistics', () => {
        it('should calculate ranking statistics', () => {
            const ranking: RankingPlayer[] = [
                { 
                    playerCharacterId: '1', 
                    race: 'TERRAN', 
                    ratingLast: 3500, 
                    leagueTypeLast: 'DIAMOND', 
                    gamesThisSeason: 50, 
                    gamesPerRace: {}, 
                    lastDatePlayed: null, 
                    online: true 
                },
                { 
                    playerCharacterId: '2', 
                    race: 'PROTOSS', 
                    ratingLast: 3300, 
                    leagueTypeLast: 'PLATINUM', 
                    gamesThisSeason: 40, 
                    gamesPerRace: {}, 
                    lastDatePlayed: null, 
                    online: false 
                }
            ]

            const stats = DataDerivationsService.getRankingStatistics(ranking)

            expect(stats.totalPlayers).toBe(2)
            expect(stats.activePlayers).toBe(1)
            expect(stats.averageRating).toBe(3400) // (3500 + 3300) / 2
            expect(stats.raceDistribution).toEqual({
                TERRAN: 1,
                PROTOSS: 1
            })
            expect(stats.leagueDistribution).toEqual({
                DIAMOND: 1,
                PLATINUM: 1
            })
        })

        it('should handle empty ranking', () => {
            const stats = DataDerivationsService.getRankingStatistics([])

            expect(stats.totalPlayers).toBe(0)
            expect(stats.activePlayers).toBe(0)
            expect(stats.averageRating).toBe(0)
            expect(stats.raceDistribution).toEqual({})
            expect(stats.leagueDistribution).toEqual({})
        })

        it('should handle null values in data', () => {
            const ranking: RankingPlayer[] = [
                { 
                    playerCharacterId: '1', 
                    race: null, 
                    ratingLast: null, 
                    leagueTypeLast: null, 
                    gamesThisSeason: 0, 
                    gamesPerRace: {}, 
                    lastDatePlayed: null, 
                    online: false 
                }
            ]

            const stats = DataDerivationsService.getRankingStatistics(ranking)

            expect(stats.totalPlayers).toBe(1)
            expect(stats.activePlayers).toBe(0)
            expect(stats.averageRating).toBe(0)
            expect(stats.raceDistribution).toEqual({ UNKNOWN: 1 })
            expect(stats.leagueDistribution).toEqual({ UNKNOWN: 1 })
        })
    })
})