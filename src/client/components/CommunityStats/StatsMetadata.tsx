import { Text, Badge } from '@mantine/core'
import { DateTime } from 'luxon'
import classes from './StatsMetadata.module.css'

interface StatsMetadataProps {
    totalPlayers: number
    generatedAt: string
    lastUpdated: string
}

export const StatsMetadata = ({ totalPlayers, generatedAt, lastUpdated }: StatsMetadataProps) => {
    const formatDate = (isoString: string) => {
        return DateTime.fromISO(isoString)
            .setZone('America/Costa_Rica')
            .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
    }

    return (
        <div className={classes.metadataContainer}>
            <div className={classes.metadataGroup}>
                <Badge variant="light" color="blue" size="lg" className={classes.playersBadge}>
                    {totalPlayers.toLocaleString()} Players
                </Badge>
                
                <div className={classes.metadataItem}>
                    <Text size="xs" c="dimmed" className={classes.metadataLabel}>Server Data Generated</Text>
                    <Text size="sm" fw={500} className={classes.metadataValue}>
                        {formatDate(generatedAt)}
                    </Text>
                </div>
                
                <div className={classes.metadataItem}>
                    <Text size="xs" c="dimmed" className={classes.metadataLabel}>Last Updated</Text>
                    <Text size="sm" fw={500} className={classes.metadataValue}>
                        {lastUpdated}
                    </Text>
                </div>
            </div>
        </div>
    )
}