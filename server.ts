import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = Number(process.env.PORT) || 3000;

  // Quản lý phòng
  const rooms = new Map<
    string,
    {
      players: { id: string; name: string; ws: WebSocket }[];
      gameState: any;
    }
  >();

  wss.on("connection", (ws) => {
    let currentRoom: string | null = null;
    let playerId: string | null = null;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "JOIN_ROOM": {
            const { roomCode, playerName } = message.payload;
            playerId = Math.random().toString(36).substring(2, 9);

            if (!rooms.has(roomCode)) {
              rooms.set(roomCode, {
                players: [{ id: playerId, name: playerName, ws }],
                gameState: null,
              });
            } else {
              const room = rooms.get(roomCode)!;

              if (room.players.length >= 2) {
                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    payload: "Phòng đã đầy!",
                  })
                );
                return;
              }

              room.players.push({
                id: playerId,
                name: playerName,
                ws,
              });
            }

            currentRoom = roomCode;
            const room = rooms.get(roomCode)!;

            room.players.forEach((p) => {
              p.ws.send(
                JSON.stringify({
                  type: "ROOM_UPDATE",
                  payload: {
                    roomCode,
                    players: room.players.map((pl) => ({
                      id: pl.id,
                      name: pl.name,
                    })),
                    isHost: room.players[0].id === p.id,
                  },
                })
              );
            });

            break;
          }

          case "GAME_ACTION": {
            if (!currentRoom || !rooms.has(currentRoom)) return;

            const room = rooms.get(currentRoom)!;

            room.players.forEach((p) => {
              if (p.ws !== ws) {
                p.ws.send(JSON.stringify(message));
              }
            });

            break;
          }

          case "START_GAME": {
            if (!currentRoom || !rooms.has(currentRoom)) return;

            const room = rooms.get(currentRoom)!;

            room.players.forEach((p) => {
              p.ws.send(
                JSON.stringify({
                  type: "GAME_STARTED",
                  payload: message.payload,
                })
              );
            });

            break;
          }
        }
      } catch (e) {
        console.error("Lỗi xử lý message:", e);
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const room = rooms.get(currentRoom)!;

        room.players = room.players.filter((p) => p.ws !== ws);

        if (room.players.length === 0) {
          rooms.delete(currentRoom);
        } else {
          room.players.forEach((p) => {
            p.ws.send(
              JSON.stringify({
                type: "OPPONENT_LEFT",
                payload: "Đối thủ đã rời phòng.",
              })
            );
          });
        }
      }
    });
  });

  // DEV MODE (Vite middleware)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    // PRODUCTION MODE (Serve build)
    const distPath = path.join(__dirname, "dist");

    app.use(express.static(distPath));

    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Lỗi khởi động server:", err);
});