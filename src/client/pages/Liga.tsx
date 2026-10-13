import { Stack, Text } from '@mantine/core'
import { liga } from '../constants/liga'
import classes from './Liga.module.css'

/**
 * /liga — Liga Tica.
 * Todo el contenido (temporada, fechas, CTA) viene del bloque tipado
 * `constants/liga`; esta página no define texto de liga.
 */
export const Liga = () => (
    <Stack className={classes.page} gap="md" align="stretch">
        <Stack gap="xs">
            <Text component="p" className={classes.kicker}>
                {`LIGA TICA · ${liga.temporada.toUpperCase()}`}
            </Text>
            <Text component="h1" className={classes.title}>
                Liga Tica
            </Text>
            <Text component="p" className={classes.lead}>
                {`La liga anual de StarCraft II de Costa Rica. ${liga.temporada}: ${liga.partidasSemanales}.`}
            </Text>
        </Stack>

        <Stack gap="sm" className={classes.panel}>
            <div className={classes.factRow}>
                <Text component="span" className={classes.factLabel}>
                    Inicio de temporada
                </Text>
                <Text component="span" className={classes.factValue}>
                    {liga.fechaInicio}
                </Text>
            </div>
            <div className={classes.factRow}>
                <Text component="span" className={classes.factLabel}>
                    Cierre de inscripciones
                </Text>
                <Text component="span" className={classes.factValue}>
                    {liga.cierreInscripciones}
                </Text>
            </div>
        </Stack>

        <Stack gap="xs" align="flex-start">
            <a
                className={classes.cta}
                href={liga.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
            >
                Inscribirme al challenge
            </a>
        </Stack>
    </Stack>
)
