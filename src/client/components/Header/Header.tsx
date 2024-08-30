import { useState } from 'react'
import { Container, Group, Burger, Menu, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
// import { MantineLogo } from '@mantinex/mantine-logo'
import classes from './HeaderSimple.module.css'
import { Logo } from '../Logo/Logo'
import { Link } from 'react-router-dom'
import { links } from '../../constants/navigation'

export const Header = () => {
    const [opened, { toggle }] = useDisclosure(false)
    const [active, setActive] = useState(links[0].link)

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
                    <Stack onClick={toggle} className={classes.mobileLinks} gap={6} hiddenFrom="md">
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
