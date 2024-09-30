import { useDisclosure } from '@mantine/hooks'
import { Modal, Button } from '@mantine/core'

export const Description = ({ descriptionHtml }) => {
    const [opened, { open, close }] = useDisclosure(false)

    return (
        <>
            <Modal
                opened={opened}
                onClose={close}
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 3,
                }}
            >
                <span
                    dangerouslySetInnerHTML={{
                        __html: descriptionHtml.replace(/<br\s*\/?>/gi, ''),
                    }}
                />
            </Modal>

            <Button onClick={open}>Descripción</Button>
        </>
    )
}
