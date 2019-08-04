const { createServer } = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const uid = () => {
  const seed = crypto.randomBytes(32);
  return crypto.createHash('sha256').update(seed).digest('hex');
}

const httpServer = createServer(function(request, response) {
  const list = [];
  socket.clients.forEach(client => list.push(client.id));

  response.end(JSON.stringify(list));
});

const socket = new WebSocket.Server({
  server: httpServer,
  port: Number(process.env.SOCKET_PORT || 5000),
  path: '/'
});

socket.on('connection', handleConnection);

function handleConnection(connection) {
  connection.id = uid();
  connection.on('close', () => console.log(`${connection.id} disconnected.`));
  connection.on('message', function(message) {
    const relayMessage = `${connection.id} ${message}`;
    const target = message[0] === '@' ? String(message).slice(1, 65) : '';
    const clients = Array.from(socket.clients)
      .filter(client => client !== connection && (!target || target === client.id));

    clients.forEach(client => {
      console.log(`${Date.now()} ${client.id} ${message}`);
      client.send(relayMessage);
    });
  });
}

httpServer.listen(Number(process.env.HTTP_PORT || 80));
