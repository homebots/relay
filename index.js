const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');
const Url = require('url');

const httpPort = Number(process.env.HTTP_PORT || 80);
const socketPort = Number(process.env.SOCKET_PORT || 3000);
const useSsl = !!process.env.SSL;
const relayMap = new Map();
const socketServer = (useSsl ? https : http).createServer();

const uid = () => {
  const seed = crypto.randomBytes(32);
  return crypto.createHash('sha256').update(seed).digest('hex');
}

const log = (...args) => process.env.DEBUG ? console.log(...args) : '';

const httpServer = http.createServer(function(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Request-Method', '*');
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (request.method === 'OPTIONS') {
    response.writeHead(200);
    response.end();
    return;
  }

  if (request.url === '/reset') {
    relayMap.forEach(socket => socket.close());
    relayMap.clear();
    response.end('OK');
    return;
  }

  if (request.url === '/new') {
    response.end(uid());
    return;
  }

  if (request.url === '/status') {
    const list = {};
    relayMap.forEach(socket => list[socket.id] = socket.clients.size);
    response.end(JSON.stringify(list, null, 2));
    return;
  }

  response.writeHead(404, 'Not found');
  response.end('');
});

socketServer.on('upgrade', function (request, socket, head) {
  const pathname = Url.parse(request.url).pathname;
  const sessionId = pathname.slice(1);

  if (!sessionId) {
    socket.destroy();
    return;
  }

  let relay = relayMap.get(sessionId);

  if (!relay) {
    relay = new WebSocket.Server({ noServer: true })
    relay.id = sessionId;
    relayMap.set(sessionId, relay);
  }

  relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.id = sessionId;
    handleNewClient(webSocket);
  });
});

function broadcast(origin, message) {
  const hexMessage = typeof message !== 'string' ? message.toString('hex') : message;
  const sessionId = origin.id;
  const socket = relayMap.get(sessionId);

  // || Array.from(socket.clients).length === 1
  if (!socket) return;

  const clients = Array.from(socket.clients).filter(client => client !== origin);

  log(`FROM ${origin.id} ${message.length}: ${hexMessage}`);

  clients.forEach(client => {
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
  socket.on('message', function(message) {
    if (message === 'text') {
      socket.textOnly = true;
      return;
    }

    broadcast(socket, message);
  });
}

function cleanup() {
  relayMap.forEach((value, key) => {
    if (!value.clients.size) {
      value.close();
      relayMap.delete(key);
    }
  });
}

httpServer.listen(httpPort);
socketServer.listen(socketPort);

setInterval(cleanup, 5000);

console.log(`[${new Date().toISOString()}] relay running at ${httpPort}, socks at ${socketPort}`);
