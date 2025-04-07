// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Object to store room information.
// Each room stores a "players" object mapping socket IDs to an object with color, etc.
const rooms = {};

// Serve static files from the "public" directory.
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined room ${roomName}`);

    if (!rooms[roomName]) {
      rooms[roomName] = { players: {} };
    }

    let assignedColor = 'spectator';
    const roomPlayers = rooms[roomName].players;
    if (!Object.values(roomPlayers).some(player => player.color === 'black')) {
      assignedColor = 'black';
    } else if (!Object.values(roomPlayers).some(player => player.color === 'white')) {
      assignedColor = 'white';
    }
    roomPlayers[socket.id] = { color: assignedColor, undoRequestsUsed: 0 };

    socket.emit('assignColor', { color: assignedColor, room: roomName });
  });

  // Relay move, pass, and restart events.
  socket.on('move', (data) => {
    console.log('Move received:', data);
    io.in(data.room).emit('move', data);
  });

  socket.on('pass', (data) => {
    console.log('Pass received:', data);
    io.in(data.room).emit('pass', data);
  });

  // Surrender: broadcast the surrender event.
  socket.on('surrender', (data) => {
    console.log('Surrender received in room:', data.room, 'from', socket.id);
    io.in(data.room).emit('surrender', data);
  });

  // Restart negotiation events.
  socket.on('restartRequest', (data) => {
    console.log("Restart request received in room", data.room, "from", socket.id);
    io.in(data.room).emit('restartRequest', data);
  });
  socket.on('restartResponse', (data) => {
    console.log("Restart response received in room", data.room, "accepted:", data.accepted);
    io.in(data.room).emit('restartResponse', data);
  });

//   socket.on('restart', (room) => {
//     console.log('Restart requested in room:', room, 'by', socket.id);
//     io.in(room).emit('restart');
//   });

  // --- New Undo Events ---
  socket.on('undoRequest', (data) => {
    console.log('Undo request received from', socket.id, 'in room', data.room);
    // Broadcast the request to all clients in the room.
    io.in(data.room).emit('undoRequest', data);
  });

  socket.on('undoResponse', (data) => {
    console.log('Undo response received in room', data.room, 'accepted:', data.accepted);
    io.in(data.room).emit('undoResponse', data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const roomName in rooms) {
      if (rooms[roomName].players[socket.id]) {
        delete rooms[roomName].players[socket.id];
        if (Object.keys(rooms[roomName].players).length === 0) {
          delete rooms[roomName];
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
