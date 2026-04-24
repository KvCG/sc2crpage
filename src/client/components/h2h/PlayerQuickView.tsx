import { useEffect, useMemo, useState } from 'react'
import {
    Affix,
    Box,
    Button,
    Divider,
    Group,
    Image,
    Paper,
    Stack,
    Text,
} from '@mantine/core'
import { useClickOutside, useMediaQuery } from '@mantine/hooks'
import { IconX } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getTopH2HPairs } from '../../services/api'
import type { TopPairEntry } from '../../../shared/types'
import type { H2HQuickViewPlayer } from '../../types/h2hQuickView'

interface PlayerQuickViewProps {
    opened: boolean
    player: H2HQuickViewPlayer | null
    onClose: () => void
}

interface SuggestedRival {
    id: number
    name: string
    matchCount: number
}

const LEAGUE_LABELS: Record<number, string> = {
    0: 'Bronze',
    1: 'Silver',
    2: 'Gold',
    3: 'Platinum',
    4: 'Diamond',
    5: 'Master',
    6: 'Grandmaster',
}

const getLeagueLabel = (leagueType: number): string => {
    return LEAGUE_LABELS[leagueType] ?? 'Unknown'
}

const renderProfile = (player: H2HQuickViewPlayer, compact = false) => {
    const raceAsset = raceAssets[player.mainRace as keyof typeof raceAssets]
    const leagueIconSize = compact ? 22 : 28
    const raceIconSize = compact ? 16 : 20
    const nameSize = compact ? 'sm' : 'md'
    const metaSize = compact ? 'xs' : 'sm'
    const sectionGap = compact ? 'sm' : 'lg'
    const rootGap = compact ? 'xs' : 'sm'

    return (
        <Stack gap={rootGap}>
            <Group justify="space-between" align="center">
                <Box>
                    <Text fw={700} size={nameSize}>
                        {player.displayName}
                    </Text>
                    <Text size={metaSize} c="dimmed">
                        {player.btag}
                    </Text>
                </Box>
                <Group gap="xs" align="center">
                    <Image
                        src={getLeagueSrc(player.leagueType)}
                        alt="league"
                        w={leagueIconSize}
                        h={leagueIconSize}
                    />
                    <Text size={metaSize}>{getLeagueLabel(player.leagueType)}</Text>
                </Group>
            </Group>

            <Group gap={sectionGap} align="center">
                <Box>
                    <Text size="xs" c="dimmed">
                        MMR
                    </Text>
                    <Text fw={700} size={compact ? 'sm' : 'md'}>
                        {player.mmr}
                    </Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">
                        Main Race
                    </Text>
                    <Group gap="xs" align="center">
                        {raceAsset?.assetPath && (
                            <Image
                                src={raceAsset.assetPath}
                                alt={`${player.mainRace} race icon`}
                                w={raceIconSize}
                                h={raceIconSize}
                            />
                        )}
                        <Text fw={700} size={compact ? 'sm' : 'md'}>
                            {player.mainRace}
                        </Text>
                    </Group>
                </Box>
            </Group>
        </Stack>
    )
}

export const PlayerQuickView = ({ opened, player, onClose }: PlayerQuickViewProps) => {
    const isCompactViewport = useMediaQuery('(max-width: 62em)') ?? false
    const quickViewRef = useClickOutside(onClose)
    const navigate = useNavigate()
    const [topPairs, setTopPairs] = useState<TopPairEntry[]>([])
    const [isLoadingTopPairs, setIsLoadingTopPairs] = useState(false)

    useEffect(() => {
        if (!opened || !player) {
            return
        }

        let mounted = true
        setIsLoadingTopPairs(true)

        getTopH2HPairs()
            .then((topPairsResponse) => {
                if (!mounted) {
                    return
                }

                setTopPairs(Array.isArray(topPairsResponse.data) ? topPairsResponse.data : [])
            })
            .catch(() => {
                if (mounted) {
                    setTopPairs([])
                }
            })
            .finally(() => {
                if (mounted) {
                    setIsLoadingTopPairs(false)
                }
            })

        return () => {
            mounted = false
        }
    }, [opened, player])

    useEffect(() => {
        if (!opened) {
            return
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', onKeyDown)

        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [opened, onClose])

    const selectedPlayerId = player?.characterId ?? null
    const suggestedRivals = useMemo(() => {
        if (selectedPlayerId === null) {
            return []
        }

        const uniqueRivals = new Map<number, SuggestedRival>()
        for (const pair of topPairs) {
            if (pair.player1.characterId === selectedPlayerId) {
                uniqueRivals.set(pair.player2.characterId, {
                    id: pair.player2.characterId,
                    name: pair.player2.name ?? pair.player2.btag.split('#')[0],
                    matchCount: pair.matchCount,
                })
            }

            if (pair.player2.characterId === selectedPlayerId) {
                uniqueRivals.set(pair.player1.characterId, {
                    id: pair.player1.characterId,
                    name: pair.player1.name ?? pair.player1.btag.split('#')[0],
                    matchCount: pair.matchCount,
                })
            }

            if (uniqueRivals.size >= 3) {
                break
            }
        }

        return Array.from(uniqueRivals.values()).slice(0, 3)
    }, [selectedPlayerId, topPairs])

    if (!opened || !player) {
        return null
    }

    const handleSelectPlayer = (player2Id: number) => {
        const player1Param = encodeURIComponent(String(player.characterId))
        const player2Param = encodeURIComponent(String(player2Id))
        navigate(`/h2h?player1=${player1Param}&player2=${player2Param}`)
        onClose()
    }

    const renderPlayerChooser = () => {
        return (
            <Stack gap="xs" mt="sm">
                <Divider />
                <Text fw={600} size="sm">
                    Rivals
                </Text>

                {isLoadingTopPairs && (
                    <Text size="xs" c="dimmed">
                        Loading rivals...
                    </Text>
                )}

                {!isLoadingTopPairs && suggestedRivals.length > 0 && (
                    <Stack gap={4}>
                        {suggestedRivals.map((suggestedRival) => (
                            <Button
                                key={suggestedRival.id}
                                variant="light"
                                justify="space-between"
                                onClick={() => handleSelectPlayer(suggestedRival.id)}
                                aria-label={`Launch H2H versus ${suggestedRival.name}`}
                            >
                                {suggestedRival.name} ({suggestedRival.matchCount} games)
                            </Button>
                        ))}
                    </Stack>
                )}

                {!isLoadingTopPairs && suggestedRivals.length === 0 && (
                    <Text size="xs" c="dimmed">
                        No rivalry data available for this player.
                    </Text>
                )}
            </Stack>
        )
    }

    if (isCompactViewport) {
        return (
            <Box
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 320,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                }}
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                        onClose()
                    }
                }}
            >
                <Paper
                    ref={quickViewRef}
                    withBorder
                    shadow="md"
                    p="sm"
                    w="min(92vw, 26rem)"
                    radius="md"
                    style={{
                        background: 'rgba(30, 31, 34, 0.92)',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <Group justify="space-between" align="center" mb="xs">
                        <Text fw={700} size="sm">
                            Player Quick View
                        </Text>
                        <Button
                            variant="subtle"
                            size="compact-xs"
                            aria-label="Dismiss player quick view"
                            onClick={onClose}
                        >
                            <IconX size={14} />
                        </Button>
                    </Group>
                    {renderProfile(player, true)}
                    {renderPlayerChooser()}
                </Paper>
            </Box>
        )
    }

    return (
        <Affix position={{ bottom: 24, right: 24 }} zIndex={300}>
            <Paper ref={quickViewRef} withBorder shadow="lg" p="md" w={320}>
                <Group justify="space-between" align="center" mb="xs">
                    <Text fw={700} size="sm">
                        Player Quick View
                    </Text>
                    <Button
                        variant="subtle"
                        size="compact-xs"
                        aria-label="Dismiss player quick view"
                        onClick={onClose}
                    >
                        <IconX size={14} />
                    </Button>
                </Group>
                {renderProfile(player)}
                {renderPlayerChooser()}
            </Paper>
        </Affix>
    )
}