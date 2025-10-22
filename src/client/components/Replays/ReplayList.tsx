import { SimpleGrid, Notification } from '@mantine/core'
import { ReplayCard } from './ReplayCard'
import { ReplayWithFolder } from '../../../shared/folderTypes'

interface ReplayListProps {
    confirmDelete: (file: object) => void
    confirmMove?: (replay: object) => void
    fetchData: ReplayWithFolder[]
    fetchError: any
    fetchLoading: boolean
}

export const ReplayList = ({
    confirmDelete,
    confirmMove,
    fetchData,
    fetchError,
    fetchLoading
}: ReplayListProps) => {

    if (fetchLoading) return <div>Loading...</div>
    if (fetchError) {
        return <Notification color="red">{fetchError}</Notification>
    }

    return (
        <SimpleGrid
            cols={{
                base: 1,
                sm: 2,
                md: 3,
                lg: 3,
            }}
            spacing="lg"
        >
            {fetchData?.map(replay => (
                <ReplayCard
                    key={replay.id}
                    replay={replay}
                    confirmDelete={confirmDelete}
                    confirmMove={confirmMove || (() => { })}
                />
            ))}
        </SimpleGrid>
    )
}
