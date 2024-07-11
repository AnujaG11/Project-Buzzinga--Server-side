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
let users = {};  // Stores user data
let rooms = {};  // Stores active rooms
let roomHosts = {};  // Maps roomId to host socket ID


io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);
  // Set default name
  users[socket.id] = { id: socket.id, name: `User${socket.id.substr(0, 2)}`, isHost: false };
  // Emit user list to everyone upon new connection
  io.emit('users', Object.values(users));
  socket.on('message', (message) => {
    console.log(`Message received: ${message}`);
    io.emit('message', `${users[socket.id].name}: ${message}`); // Use user name
  });




  socket.on('createRoom', () => {
    const roomId = crypto.randomBytes(3).toString('hex'); // Generate a random room ID
    rooms[roomId] = [socket.id]; // Store the room with the creator's socket ID
    roomHosts[roomId] = socket.id; // Set the creator as the host
    users[socket.id].isHost = true; // Mark the user as host
    socket.join(roomId);
    socket.emit('roomCreated', roomId); // Emit the roomId only to the creator
    emitRoomUsers(roomId); // Emit the user list to the room
  });





  socket.on('joinRoom', (roomId, callback) => {
    if (rooms[roomId]) {
      if (!rooms[roomId].includes(socket.id)) {
        rooms[roomId].push(socket.id); // Add the user to the room only if not already present
      }
      socket.join(roomId);
      emitRoomUsers(roomId); // Emit the user list to the room
      io.to(roomId).emit('notification', `${users[socket.id].name} has joined the room`); // Notify others
      callback(true); // Notify the client that the join was successful
    } else {
      callback(false); // Notify the client that the room was not found
    }
  });




  socket.on('buzzer', () => {
    const timestamp = new Date().toLocaleTimeString();
    io.emit('buzzer', { name: users[socket.id].name, timestamp }); // Use user name
  });



  socket.on('setName', (name) => {
    if (name && name.trim()) {
      users[socket.id].name = name; // Update the user's name
      io.emit('users', Object.values(users)); // Broadcast updated user list to everyone
      const roomId = Object.keys(rooms).find(roomId => rooms[roomId].includes(socket.id));
      if (roomId) {
        emitRoomUsers(roomId); // Emit the updated user list to the room
      }
    }
  });



  socket.on('disconnect', () => {
    console.log(`A user disconnected: ${socket.id}`);
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].includes(socket.id));
    if (roomId) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      emitRoomUsers(roomId); // Emit the updated user list to the room
      io.to(roomId).emit('notification', `${users[socket.id].name} has left the room`); // Notify others
      if (rooms[roomId].length === 0) {
        delete rooms[roomId]; // Remove the room if it's empty
        delete roomHosts[roomId]; // Remove the room host mapping
      }
    }
    delete users[socket.id]; // Remove user from user list
    io.emit('users', Object.values(users)); // Emit the updated user list to everyone
  });
});



function emitRoomUsers(roomId) {
  if (!rooms[roomId]) return;

  io.to(roomId).emit('users', rooms[roomId].map(id => ({
    id,
    name: users[id].name,  
    isHost: roomHosts[roomId] === id
  })));
}



httpServer.listen(port, () => console.log(`Listening on port ${port}`));
