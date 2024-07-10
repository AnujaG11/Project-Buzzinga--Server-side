const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const httpServer = http.createServer(app);
const io = socketIo(httpServer, {
  cors: { origin: '*' }
});

const port = 3000;
let users = {};
let rooms = {};  // to store active rooms
let roomHosts = {};

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  users[socket.id] = `User${socket.id.substr(0, 2)}`; // Default name
  io.emit('users', Object.values(users)); 

  socket.on('message', (message) => {
    console.log('Message received:', message);
    io.emit('message', `${users[socket.id]}: ${message}`);
  });

  socket.on('createRoom', () => {
    const roomId = crypto.randomBytes(3).toString('hex'); // Random room ID
    rooms[roomId] = [socket.id]; // Store the room with the creator's socket ID
    roomHosts[roomId] = socket.id; // Set the creator as the host
    socket.join(roomId);
    socket.emit('roomCreated', roomId); // Emit the roomId only to the creator
    io.to(roomId).emit('users', rooms[roomId].map(id => ({
      id,
      name: users[id],
      isHost: roomHosts[roomId] === id
    }))); // Emit the user list to the room
  });
  

  socket.on('joinRoom', (roomId, callback) => {
    console.log(roomId, "----------------------------------");
    if (rooms[roomId]) {
      rooms[roomId].push(socket.id); // Add the user to the room
      socket.join(roomId);


      io.to(roomId).emit('users', rooms[roomId].map(id => ({
        id,
        name: users[id],
        isHost: roomHosts[roomId] === id
      }))); // Emit the user list to the room
      io.to(roomId).emit('notification', `${users[socket.id]} has joined the room`); // Notify others


      callback(true); // Notify the client that the join was successful
    } else {
      callback(false); // Notify the client that the room was not found
    }
  });

  socket.on('buzzer', () => {
    const timestamp = new Date().toLocaleTimeString();
    io.emit('buzzer', { name: users[socket.id], timestamp });
  });

   socket.on('setName', (name) => {
    if (name && name.trim()) {
      users[socket.id] = name;
      const roomId = Object.keys(rooms).find(roomId => rooms[roomId].includes(socket.id));
      if (roomId) {
        io.to(roomId).emit('users', rooms[roomId].map(id => ({
          id,
          name: users[id],
          isHost: roomHosts[roomId] === id
        }))); // Update user list for the room
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected!');
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].includes(socket.id));
    if (roomId) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      io.to(roomId).emit('users', rooms[roomId].map(id => ({
        id,
        name: users[id],
        isHost: roomHosts[roomId] === id
      }))); // Update user list for the room
      io.to(roomId).emit('notification', `${users[socket.id]} has left the room`); // Notify others
    }
    delete users[socket.id];
  });
});

httpServer.listen(port, () => console.log(`listening on port ${port}`));