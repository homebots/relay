const { createServer } = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');

const httpPort = process.env.HTTP_PORT || 443;
const socketPort = process.env.SOCKET_PORT || 3000;

const uid = () => {
  const seed = crypto.randomBytes(32);
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 7);
}

const log = (...args) => process.env.DEBUG ? console.log(...args) : '';

const httpServer = createServer(function(request, response) {
  if (request.url === '/') {
    const list = Array.from(socket.clients).map(client => client.id);
    response.end(JSON.stringify(list));
  }

  response.writeHead(404, 'Not found');
  response.end('');
});

const socket = new WebSocket.Server({
  server: httpServer,
  port: Number(socketPort),
  path: '/hub'
});

const nullOrigin = { id: '0000000' };
function broadcast(origin, message) {
  const relayMessage = `${origin.id} ${message}`;
  const target = message[0] === '@' ? String(message).slice(1, 65) : '';
  const clients = Array.from(socket.clients)
    .filter(client => client !== origin && (!target || target === client.id));

  clients.forEach(client => {
    log(`${Date.now()} ${client.id} ${message}`);
    client.send(relayMessage);
  });
}

function handleConnection(connection) {
  connection.id = uid();
  connection.on('close', () => broadcast(nullOrigin, `-${connection.id}`));
  connection.on('message', function(message) {
    broadcast(connection, message);
  });

  broadcast(nullOrigin, `+${connection.id}`)
}

socket.on('connection', handleConnection);
httpServer.listen(httpPort);

console.log(`[${Date.now()}] relay running at ${httpPort}, ${socketPort}`);
