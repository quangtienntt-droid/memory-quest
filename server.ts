import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Ép kiểu PORT về Number để tránh lỗi "No overload matches this call"
  const PORT = Number(process.env.PORT) || 3000;

  // Quản lý trạng thái phòng chơi
  const rooms = new Map<string, {
    players: { id: string, name: string, ws: WebSocket }[],
    gameState: any
  }>();

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
                gameState: null
              });
            } else {
              const room = rooms.get(roomCode)!;
              if (room.players.length >= 2) {
                ws.send(JSON.stringify({ type: "ERROR", payload: "Phòng đã đầy!" }));
                return;
              }
              room.players.push({ id: playerId, name: playerName, ws });
            }

            currentRoom = roomCode;
            const room = rooms.get(roomCode)!;

            // Thông báo cho tất cả người chơi trong phòng
            room.players.forEach(p => {
              p.ws.send(JSON.stringify({
                type: "ROOM_UPDATE",
                payload: {
                  roomCode,
                  players: room.players.map(pl => ({ id: pl.id, name: pl.name })),
                  isHost: room.players[0].id === p.id
                }
              }));
            });
            break;
          }

          case "GAME_ACTION": {
            if (!currentRoom || !rooms.has(currentRoom)) return;
            const room = rooms.get(currentRoom)!;
            // Gửi hành động cho đối thủ
            room.players.forEach(p => {
              if (p.ws !== ws) {
                p.ws.send(JSON.stringify(message));
              }
            });
            break;
          }

          case "START_GAME": {
            if (!currentRoom || !rooms.has(currentRoom)) return;
            const room = rooms.get(currentRoom)!;
            room.players.forEach(p => {
              p.ws.send(JSON.stringify({ type: "GAME_STARTED", payload: message.payload }));
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
        room.players = room.players.filter(p => p.ws !== ws);
        
        if (room.players.length === 0) {
          rooms.delete(currentRoom);
        } else {
          room.players.forEach(p => {
            p.ws.send(JSON.stringify({
              type: "OPPONENT_LEFT",
              payload: "Đối thủ đã rời phòng."
            }));
          });
        }
      }
    });
  });

  // Cấu hình Middleware
 if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);

  } else {
    // Chế độ thực tế (Production) - Serve thư mục dist sau khi build
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Lắng nghe kết nối
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server is running on: http://localhost:${PORT}`);
    console.log(`🌐 Public access available via: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Lỗi khởi động server:", err);
});