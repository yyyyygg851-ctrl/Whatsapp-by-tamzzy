const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let file = req.url === "/" ? "/index.html" : req.url;
  file = path.join(__dirname, file);

  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("404 Not Found");
  }

  const ext = path.extname(file);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };

  res.writeHead(200, {
    "Content-Type": types[ext] || "text/plain; charset=utf-8"
  });

  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocket.Server({ server });

const users = new Map();
const messages = [];

function broadcast(data) {
  const text = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  }
}

function onlineUsers() {
  return [...users.values()];
}

wss.on("connection", (ws) => {
  let username = null;

  ws.send(JSON.stringify({
    type: "history",
    messages
  }));

  ws.on("message", (raw) => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // LOGIN
    if (data.type === "login") {
      username = String(data.username || "User")
        .trim()
        .slice(0, 20);

      if (!username) username = "User";

      users.set(ws, username);

      ws.send(JSON.stringify({
        type: "login_ok",
        username
      }));

      broadcast({
        type: "users",
        users: onlineUsers()
      });

      broadcast({
        type: "system",
        text: `${username} bergabung ke chat`
      });

      return;
    }

    // MESSAGE
    if (data.type === "message") {
      if (!username) return;

      const text = String(data.text || "").trim();

      if (!text || text.length > 1000) return;

      const message = {
        id: Date.now() + Math.random(),
        username,
        text,
        time: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        })
      };

      messages.push(message);

      // Simpan maksimal 100 pesan di RAM
      if (messages.length > 100) {
        messages.shift();
      }

      broadcast({
        type: "message",
        message
      });
    }
  });

  ws.on("close", () => {
    if (username) {
      users.delete(ws);

      broadcast({
        type: "users",
        users: onlineUsers()
      });

      broadcast({
        type: "system",
        text: `${username} keluar dari chat`
      });
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("================================");
  console.log("   SIMPLE REALTIME CHAT");
  console.log("================================");
  console.log(`Server aktif di port ${PORT}`);
  console.log("");
  console.log(`Buka: http://localhost:${PORT}`);
  console.log("");
});
