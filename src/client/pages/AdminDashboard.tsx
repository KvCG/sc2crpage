import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Title, Text, Group, Badge, Button, Loader, Stack, Center } from '@mantine/core'
import { getAdminFlags } from '../services/api'

export const AdminDashboard: React.FC = () => {
    const [pendingCount, setPendingCount] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getAdminFlags({ status: 'pending' })
            .then((flags) => setPendingCount(flags.length))
            .catch(() => setPendingCount(null))
            .finally(() => setLoading(false))
    }, [])

    return (
        <Center mt="xl">
            <Stack align="center" gap="sm">
                <Title order={2}>Admin Dashboard</Title>

                <Group gap="xs">
                    <Text fw={600}>H2H Flag Review</Text>
                    {loading ? (
                        <Loader size="xs" />
                    ) : pendingCount !== null ? (
                        <Badge color={pendingCount > 0 ? 'yellow' : 'gray'}>
                            {pendingCount} pending
                        </Badge>
                    ) : null}
                </Group>

                <Text size="sm" c="dimmed" ta="center">
                    Review and approve or reject player-submitted match flags.
                </Text>

                <Button component={Link} to="/admin/h2h-flags" size="xs" variant="light">
                    Go to Flag Review
                </Button>
            </Stack>
        </Center>
    )
}
