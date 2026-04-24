import { Header } from './components/Header/Header.tsx'
import { Route, Routes } from 'react-router-dom'
import '@mantine/core/styles.css'
import './App.css'
import { Ranking } from './pages/Ranking.tsx'
import { Search } from './pages/Search.tsx'
import { Replay } from './pages/Replays.tsx'
import { ReplayInformation } from './pages/ReplayInformation.tsx'
import { Tournament } from './pages/Tournament.tsx'
import { CommunityStats } from './pages/CommunityStats.tsx'
import { PlayerActivity } from './pages/PlayerActivity.tsx'
import { H2H } from './pages/H2H.tsx'
import { AdminLogin } from './pages/AdminLogin.tsx'
import { AdminDashboard } from './pages/AdminDashboard.tsx'
import { FlagReview } from './pages/FlagReview.tsx'
import { PendingMatchReview } from './pages/PendingMatchReview.tsx'
import { AdminRoute } from './routes/AdminRoute.tsx'
import { AdminLayout } from './components/AdminLayout/AdminLayout.tsx'
import { Container } from '@mantine/core'

// Define functional component using TypeScript
const App: React.FC = () => {

    return (
        <>
            <Header />
            <Container>
                <Routes>
                    <Route path="/" element={<Ranking />} />
                    {/* <Route path="/tournament" element={<Tournament />} /> */}
                    <Route path="/search" element={<Search />} />
                    <Route path="/replays" element={<Replay />} />
                    <Route path="/replayInformation" element={<ReplayInformation />} />
                    <Route path="/community-stats" element={<CommunityStats />} />
                    <Route path="/player-activity" element={<PlayerActivity />} />
                    <Route path="/h2h" element={<H2H />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                        <Route index element={<AdminDashboard />} />
                        <Route path="h2h-flags" element={<FlagReview />} />
                        <Route path="pending-matches" element={<PendingMatchReview />} />
                        <Route path="players" element={<AdminDashboard />} />
                    </Route>
                    {/*<Route path="/community" element={<Community />} />
                    <Route path='/contact' element={<Contact/>} /> */}
                </Routes>
            </Container>
        </>
    )
}

export default App
