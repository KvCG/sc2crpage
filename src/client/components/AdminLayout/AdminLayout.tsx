import { NavLink } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Group } from '@mantine/core'
import classes from './AdminLayout.module.css'

const adminLinks = [
    { to: '/admin/h2h-flags', label: 'Flag Review' },
    { to: '/admin/players', label: 'Players' },
]

export const AdminLayout: React.FC = () => {
    return (
        <>
            <nav className={classes.nav}>
                <Group gap={4}>
                    {adminLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) =>
                                `${classes.link}${isActive ? ` ${classes.linkActive}` : ''}`
                            }
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </Group>
            </nav>
            <Outlet />
        </>
    )
}
