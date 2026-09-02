import { Paper, Group, Title } from '@mantine/core'
import { IconDeviceGamepad2 } from '@tabler/icons-react'

export const ReplayHeader = () => {
    return (
        <Paper 
            p="xl" 
            mb="xl" 
            radius="lg"
            style={{
                background: 'linear-gradient(135deg, var(--mantine-color-blue-8) 0%, var(--mantine-color-dark-7) 100%)',
                color: 'white'
            }}
        >
            <Group justify="center">
                <IconDeviceGamepad2 size={32} />
                <Title order={1} size="h1">
                    Replay Information
                </Title>
            </Group>
        </Paper>
    )
}