import { useEffect } from 'react'
import { Affix, Box, Button, Group, Image, Paper, Stack, Text } from '@mantine/core'
import { useClickOutside, useMediaQuery } from '@mantine/hooks'
import { IconX } from '@tabler/icons-react'
import { getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import type { H2HQuickViewPlayer } from '../../types/h2hQuickView'

interface PlayerQuickViewProps {
    opened: boolean
    player: H2HQuickViewPlayer | null
    onClose: () => void
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

    if (!opened || !player) {
        return null
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
            </Paper>
        </Affix>
    )
}