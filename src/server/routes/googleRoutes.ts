import { Router, Request, Response } from 'express'
import {
    getReplayAnalysis,
    getAllReplays,
    uploadReplay,
    deleteReplay,
    getAllFolders,
    createFolder,
    moveReplayToFolder,
    deleteFolder,
    renameFolder
} from '../services/googleApi'

const router = Router()

router.get('/getReplays', async (req: Request, res: Response) => {
    try {
        const replays = await getAllReplays()
        res.json(replays)
    } catch (error) {
        res.json({ error: 'Error getting replays' })
    }
})

router.post('/getReplayAnalysis', async (req: Request, res: Response) => {
    try {
        const replayAnalysis = await getReplayAnalysis(req)
        res.json(replayAnalysis)
    } catch (error) {
        res.json({ error: 'Error uploading the file' })
    }
})

router.post('/uploadReplay', async (req: Request, res: Response) => {
    try {
        const fileId = await uploadReplay(req)
        res.json({ fileId })
    } catch (error) {
        res.json({ error: 'Error uploading the file' })
    }
})

router.post('/deleteReplay', async (req: Request, res: Response) => {
    try {
        const deleted = await deleteReplay(req)
        if (deleted) {
            res.json({})
        } else {
            res.json({ error: 'Error deleting the file' })
        }
    } catch (error) {
        res.json({ error: 'Error deleting the file' })
    }
})

router.get('/getFolders', async (_req: Request, res: Response) => {
    try {
        const folders = await getAllFolders()
        res.json({ folders, success: true })
    } catch (error) {
        res.json({ error: 'Error getting folders', success: false })
    }
})

router.post('/createFolder', async (req: Request, res: Response) => {
    try {
        const folder = await createFolder(req)
        res.json({ folder, success: true })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error creating folder'
        res.status(400).json({ error: errorMessage, success: false })
    }
})

router.post('/moveReplay', async (req: Request, res: Response) => {
    try {
        await moveReplayToFolder(req)
        res.json({ success: true })
    } catch (error) {
        res.json({ error: 'Error moving replay', success: false })
    }
})

router.post('/deleteFolder', async (req: Request, res: Response) => {
    try {
        await deleteFolder(req)
        res.json({ success: true })
    } catch (error) {
        res.json({ error: 'Error deleting folder', success: false })
    }
})

router.post('/renameFolder', async (req: Request, res: Response) => {
    try {
        await renameFolder(req)
        res.json({ success: true })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error renaming folder'
        res.status(400).json({ error: errorMessage, success: false })
    }
})

export default router