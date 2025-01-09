import { SimpleGrid, Notification } from '@mantine/core'
import { ReplayCard } from './ReplayCard'

export const ReplayList = ({
    confirmDelete,
    fetchData,
    fetchError,
    fetchLoading,
}) => {
    return (
        <>
            {fetchLoading && <div>Loading...</div>}
            {fetchError && (
                <Notification color="red">{fetchError}</Notification>
            )}
            <SimpleGrid
                cols={{
                    base: 1,
                    sm: 2,
                    md: 3,
                }}
                spacing="lg"
            >
                {fetchData?.map(replay => (
                    <ReplayCard
                        key={replay.id}
                        replay={replay}
                        confirmDelete={confirmDelete}
                    />
                ))}
            </SimpleGrid>
        </>
    )
}
