import { Header } from './components/Header/Header.tsx'
import { Route, Routes } from 'react-router-dom'
import { Community } from './pages/Community.tsx'
import '@mantine/core/styles.css'
import './App.css'
import { Ranking } from './pages/Ranking.tsx'
import { Search } from './pages/Search.tsx'
import { Replay } from './pages/Replays.tsx'
import { ReplayInformation } from './pages/ReplayInformation.tsx'
import { Tournament } from './pages/Tournament.tsx'
import { Container } from '@mantine/core'

// Define functional component using TypeScript
const App: React.FC = () => {

    return (
        <>
            <Header />
            <Container>
                <Routes>
                    <Route path="/" element={<Ranking />} />
                    <Route path="/tournament" element={<Tournament />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/replays" element={<Replay />} />
                    <Route path="/replayInformation" element={<ReplayInformation />} />
                    {/*<Route path="/community" element={<Community />} />
                    <Route path='/contact' element={<Contact/>} /> */}
                </Routes>
            </Container>
        </>
    )
}

export default App
