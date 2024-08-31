import { useState } from 'react'
import { Container, Group, Burger, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import classes from './HeaderSimple.module.css'
import { Logo } from '../Logo/Logo'
import { Link } from 'react-router-dom'
import { links } from '../../constants/navigation'
import { useLocation } from 'react-router-dom'

export const Header = () => {
    const location = useLocation()
    const initialTab = links.filter(link => link.link === location.pathname)
    const [active, setActive] = useState(initialTab[0].link)
    const [opened, { toggle }] = useDisclosure(false)

    const items = links.map(link => (
        <Link
            to={link.link}
            className={classes.link}
            data-active={active === link.link || undefined}
            onClick={() => {
                setActive(link.link)
            }}
            key={link.label}
        >
            {link.label}
        </Link>
    ))

    return (
        <header className={classes.header}>
            <Container size="md" onMouseOut={toggle} className={classes.inner}>
                <Logo />
                <Group gap={5} visibleFrom="md">
                    {items}
                </Group>

                {opened && (
                    <Stack
                        onClick={toggle}
                        className={classes.mobileLinks}
                        gap={6}
                        hiddenFrom="md"
                    >
                        {items}
                    </Stack>
                )}

                <Burger
                    opened={opened}
                    onClick={toggle}
                    hiddenFrom="md"
                    size="sm"
                />
            </Container>
        </header>
    )
}
