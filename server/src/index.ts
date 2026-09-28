import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import type {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from '@pong/common'
import type { TypedServer } from './game'
import { createRoomsRouter } from './routes'
import { RoomManager } from './rooms'
import { registerSocketHandlers } from './sockets'

const app = express()
const httpServer = http.createServer(app)
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000

app.use(cors())
app.use(express.json())

const roomManager = new RoomManager()

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
})

app.use('/api', createRoomsRouter(roomManager))

const io: TypedServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(httpServer, {
    cors: { origin: '*' },
})

registerSocketHandlers(io, roomManager)

httpServer.listen(PORT, () => {
    console.log(`Pong server listening on http://localhost:${PORT}`)
})
