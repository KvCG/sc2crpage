import { Stack, Text } from '@mantine/core'
import { liga } from '../constants/liga'
import { useNow } from '../hooks/useNow'
import { pad2, timeLeft, TimeLeft } from '../utils/countdown'
import classes from './Liga.module.css'

const inicio = new Date(liga.inicioISO)
const cierreInscripciones = new Date(liga.cierreInscripcionesISO)

/** Entrada escalonada: cada bloque aparece un poco después del anterior. */
const reveal = (order: number, className?: string) => ({
    className: className ? `${classes.reveal} ${className}` : classes.reveal,
    style: { animationDelay: `${order * 90}ms` },
})

/** "9 d 4 h" mientras falten días; en el último día, "4 h 12 min". */
const shortLeft = ({ days, hours, minutes }: TimeLeft) =>
    days > 0 ? `${days} d ${hours} h` : `${hours} h ${minutes} min`

const CountdownCell = ({ value, label }: { value: string; label: string }) => (
    <div className={classes.cell}>
        {/* key = valor: el dígito se remonta al cambiar y repite su animación de entrada */}
        <span key={value} className={classes.digits}>
            {value}
        </span>
        <span className={classes.cellLabel}>{label}</span>
    </div>
)

/**
 * /liga — Liga Tica.
 * Todo el contenido (temporada, fechas, textos, CTA) viene del bloque tipado
 * `constants/liga`; esta página solo lo arma y corre el contador.
 */
export const Liga = () => {
    const now = useNow()
    const { textos } = liga
    const started = now >= +inicio
    const registrationOpen = now < +cierreInscripciones
    const toStart = timeLeft(inicio, now)
    const toClose = timeLeft(cierreInscripciones, now)

    const status = started
        ? textos.enCurso
        : registrationOpen
          ? `${textos.inscripcionesAbiertas} · cierran en ${shortLeft(toClose)}`
          : textos.inscripcionesCerradas

    return (
        <Stack className={classes.page} gap="md" align="stretch">
            <Stack gap="xs" {...reveal(0)}>
                <Text component="p" className={classes.kicker}>
                    {`LIGA TICA · ${liga.temporada.toUpperCase()}`}
                </Text>
                <Text component="h1" className={classes.title}>
                    {textos.titulo}
                </Text>
                <Text component="p" className={classes.lead}>
                    {`${textos.descripcion} ${liga.temporada}: ${liga.partidasSemanales}.`}
                </Text>
            </Stack>

            <div {...reveal(1)}>
                <span
                    className={classes.status}
                    data-live={started || registrationOpen || undefined}
                >
                    <span className={classes.statusDot} aria-hidden="true" />
                    {status}
                </span>
            </div>

            {!started && (
                <div {...reveal(2)}>
                    <div className={classes.countdownPanel}>
                        <Text component="p" className={classes.factLabel}>
                            {`${textos.contadorTitulo} · ${liga.fechaInicio}`}
                        </Text>
                        <div className={classes.countdown} role="timer">
                            <CountdownCell value={String(toStart.days)} label="Días" />
                            <CountdownCell value={pad2(toStart.hours)} label="Horas" />
                            <CountdownCell value={pad2(toStart.minutes)} label="Min" />
                            <CountdownCell value={pad2(toStart.seconds)} label="Seg" />
                        </div>
                    </div>
                </div>
            )}

            <Stack gap="sm" {...reveal(3, classes.panel)}>
                <div className={classes.factRow}>
                    <Text component="span" className={classes.factLabel}>
                        {textos.etiquetaInicio}
                    </Text>
                    <Text component="span" className={classes.factValue}>
                        {liga.fechaInicio}
                    </Text>
                </div>
                <div className={classes.factRow}>
                    <Text component="span" className={classes.factLabel}>
                        {textos.etiquetaCierre}
                    </Text>
                    <Text component="span" className={classes.factValue}>
                        {liga.cierreInscripciones}
                    </Text>
                </div>
            </Stack>

            <Stack gap="xs" align="flex-start" {...reveal(4)}>
                <a
                    className={classes.cta}
                    href={liga.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {started ? textos.ctaEnCurso : textos.ctaInscripcion}
                </a>
            </Stack>
        </Stack>
    )
}
