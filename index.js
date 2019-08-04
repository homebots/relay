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
  port: 5000,
  path: '/'
});

socket.on('connection', handleConnection);

function handleConnection(connection) {
  connection.id = uid();
  connection.on('close', () => console.log(`${connection.id} disconnected.`));
  connection.on('message', function(message) {
    let target = '';

    if (message[0] === '@') {
      target = String(message).slice(1, 65);
    }

    socket.clients.forEach(client => {
      if (client !== connection && (!target || target === client.id)) {
        console.log(`${client.id} > ${message}`);
        client.send(message);
      }
    });
  });
}

httpServer.listen(80);
