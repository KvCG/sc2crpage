import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Container, PasswordInput, Stack, Text, Title } from '@mantine/core'
import { postAdminLogin } from '../services/api'

export const AdminLogin: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const from = (location.state as { from?: string })?.from ?? '/admin'

    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const { token } = await postAdminLogin(password)
            sessionStorage.setItem('adminToken', token)
            navigate(from, { replace: true })
        } catch (err: any) {
            if (err?.response?.status === 401) {
                setError('Invalid password.')
            } else {
                setError('Login failed. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Container size="xs" mt="xl">
            <Title order={2} mb="md">Admin Login</Title>
            <form onSubmit={handleSubmit}>
                <Stack>
                    <PasswordInput
                        label="Password"
                        placeholder="Enter admin password"
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        required
                        autoFocus
                    />
                    {error && <Text c="red" size="sm">{error}</Text>}
                    <Button type="submit" loading={loading}>
                        Login
                    </Button>
                </Stack>
            </form>
        </Container>
    )
}
