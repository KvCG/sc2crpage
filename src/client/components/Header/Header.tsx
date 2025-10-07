import { useState } from 'react'
import { Container, Group, Burger, Stack, Menu } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import classes from './Header.module.css'
import { Logo } from '../Logo/Logo'
import { Link } from 'react-router-dom'
import { links } from '../../constants/navigation'
import { useLocation } from 'react-router-dom'

export const Header = () => {
    const location = useLocation()
    const initialTab = links.filter((link) => link.link === location.pathname)
    const [active, setActive] = useState(initialTab[0]?.link)
    const [opened, { toggle }] = useDisclosure(false)

    const items = links.map((link) => (
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

    // Mobile navigation items (wrapped in Menu.Item)
    const mobileItems = links.map((link) => (
        <Menu.Item key={link.label}>
            <Link
                to={link.link}
                className={classes.link}
                data-active={active === link.link || undefined}
                onClick={() => {
                    setActive(link.link)
                    toggle() // Close menu after selection
                }}
            >
                {link.label}
            </Link>
        </Menu.Item>
    ))
    return (
        <header className={classes.header}>
            <Container size="md" className={classes.inner}>
                <Logo />
                <Group gap={5} visibleFrom="md">
                    {items}
                </Group>

                <Menu opened={opened} onChange={toggle}>
                    <Menu.Target>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" />
                    </Menu.Target>
                    <Menu.Dropdown>{mobileItems}</Menu.Dropdown>
                </Menu>
            </Container>
        </header>
    )
}
