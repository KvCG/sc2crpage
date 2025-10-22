import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ReplayCard } from './ReplayCard'
import { ReplayWithFolder } from '../../../shared/folderTypes'

interface DraggableReplayCardProps {
    replay: ReplayWithFolder
    confirmDelete: (file: object) => void
    confirmMove: (replay: object) => void
    currentFolderId: string
}

export const DraggableReplayCard = ({
    replay,
    confirmDelete,
    confirmMove,
    currentFolderId
}: DraggableReplayCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: replay.id,
        data: {
            type: 'replay',
            replay,
            currentFolderId
        }
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div
                {...listeners}
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    background: 'rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    fontSize: '12px'
                }}
            >
                ⋮⋮
            </div>

            <ReplayCard
                replay={replay}
                confirmDelete={confirmDelete}
                confirmMove={confirmMove}
            />
        </div>
    )
}