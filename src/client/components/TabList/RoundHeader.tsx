import { Box, Text } from '@mantine/core'

export const RoundHeader = ({ round }) => {
    return (
        <Box style={{ width: '100%' }}>
            <Text size="lg" style={{ width: '100%' }}>
                Jornada {round}
            </Text>
        </Box>
    )
}
