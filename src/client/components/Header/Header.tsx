import { useState } from 'react'
import { Container, Group, Burger } from '@mantine/core'
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
            <Container size="md" className={classes.inner}>
                <Logo />
                <Group gap={5} visibleFrom="xs">
                    {items}
                </Group>

                <Burger
                    opened={opened}
                    onClick={toggle}
                    hiddenFrom="xs"
                    size="sm"
                />
            </Container>
        </header>
    )
}
