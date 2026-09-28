import { Request, Response, Router } from 'express'

export const HealthRouter = Router()

HealthRouter.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' })
})
