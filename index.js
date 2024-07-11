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
  console.log('a user connected', socket.id);

  // Set default name
  users[socket.id] = { id: socket.id, name: `User${socket.id.substr(0, 2)}`, isHost: false };
  io.emit('users', Object.values(users)); // Broadcast users to everyone

  socket.on('message', (message) => {
    console.log('Message received:', message);
    io.emit('message', `${users[socket.id].name}: ${message}`); // Use user name
  });

  socket.on('createRoom', () => {
    const roomId = crypto.randomBytes(3).toString('hex'); // Generate a random room ID
    rooms[roomId] = [socket.id]; // Store the room with the creator's socket ID
    roomHosts[roomId] = socket.id; // Set the creator as the host
    socket.join(roomId);
    socket.emit('roomCreated', roomId); // Emit the roomId only to the creator
    io.to(roomId).emit('users', rooms[roomId].map(id => ({
      id,
      name: users[id].name,  // Ensure the correct name is sent
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
        name: users[id].name,  // Ensure the correct name is sent
        isHost: roomHosts[roomId] === id
      }))); // Emit the user list to the room
      if(roomId){
      io.to(roomId).emit('notification', `${users[socket.id].name} has joined the room`); // Notify others
      }
      else{
        io.to(roomId).emit('notification', `${users[socket.id].name} welcome to the application`); // Notify others
      }

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
      // Update the user object with the new name
      users[socket.id] = { ...users[socket.id], name };
      io.emit('users', Object.values(users).map(user => ({
        id: user.id,
        name: user.name, // Ensure the name property is used
        isHost: Object.keys(roomHosts).some(roomId => roomHosts[roomId] === user.id)
      }))); // Broadcast updated user list to everyone

      const roomId = Object.keys(rooms).find(roomId => rooms[roomId].includes(socket.id));
      if (roomId) {
        io.to(roomId).emit('users', rooms[roomId].map(id => ({
          id,
          name: users[id].name, // Ensure the correct name is sent
          isHost: roomHosts[roomId] === id
        }))); // Emit the updated user list to the room
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
        name: users[id].name, // Ensure the correct name is sent
        isHost: roomHosts[roomId] === id
      }))); 
      io.to(roomId).emit('notification', `${users[socket.id].name} has left the room`); // Notify others
    }
    delete users[socket.id]; // Remove user from user list
  });
});

httpServer.listen(port, () => console.log(`listening on port ${port}`));
