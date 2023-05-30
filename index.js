import http from "http";
import crypto from "crypto";
import WebSocket from "ws";

const port = Number(process.env.PORT);
const relayMap = new Map();
const socketServer = http.createServer();

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);
const uid = () =>
  crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");

socketServer.on("request", (request) =>
  console.log(request.url, request.method)
);

socketServer.on("upgrade", function (request, socket, head) {
  const pathname = new URL(String(request.url), "http://localhost").pathname;
  const sessionId = pathname.slice(1);

  if (!sessionId) {
    socket.destroy();
    return;
  }

  log(`New client in ${sessionId}`);
  let relay = relayMap.get(sessionId);

  if (!relay) {
    relay = new WebSocket.Server({ noServer: true });
    relay.id = sessionId;
    relayMap.set(sessionId, relay);
  }

  relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.id = sessionId;
    handleNewClient(webSocket);
  });
});

function broadcast(origin, message) {
  const sessionId = origin.id;
  const socket = relayMap.get(sessionId);

  if (!socket || socket.clients.size < 2) {
    return;
  }

  const hexMessage =
    typeof message !== "string" ? message.toString("hex") : message;

  socket.clients.forEach((client) => {
    if (client === origin || client.readyState !== WebSocket.OPEN) return;

    if (client.textOnly) {
      log(`TO ${client.id} ${hexMessage}`);
      client.send(hexMessage);
      return;
    }

    log(`TO ${client.id} #${message.length}`);
    client.send(message);
  });
}

function handleNewClient(socket) {
  socket.on("message", function (message) {
    if (message === "text") {
      socket.textOnly = true;
      return;
    }

    broadcast(socket, message);
  });
}

function cleanup() {
  relayMap.forEach((relay, key) => {
    if (!relay.clients.size) {
      log(`Deleting stale session ${relay.id}`);
      relay.close();
      relayMap.delete(key);
    }
  });
}

socketServer.listen(port);
setInterval(cleanup, 5000);
console.log(`[${new Date().toISOString()}] relay running at ${port}`);
