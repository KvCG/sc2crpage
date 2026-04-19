import { Navigate, useLocation } from 'react-router-dom'

interface AdminRouteProps {
    children: React.ReactNode
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const location = useLocation()
    const token = sessionStorage.getItem('adminToken')

    if (!token) {
        return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
    }

    return <>{children}</>
}
