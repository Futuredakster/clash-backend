const { StreamToken } = require('../models');

const hosts = {}; // bracket_id -> hostSocketId

function setupSocket(io) {
  // Auth middleware
  io.use(async (socket, next) => {
    const { token } = socket.handshake.auth;
    if (!token) return next(new Error('No token provided'));

    try {
      const stream = await StreamToken.findOne({ where: { token } });
      if (!stream || !stream.isActive) {
        return next(new Error('Invalid or inactive token'));
      }

      socket.streamRole = stream.role;
      socket.bracket_id = stream.bracket_id;
      socket.token = token;

      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, role: ${socket.streamRole}, round: ${socket.bracket_id}`);

    if (socket.streamRole === 'host') {
      hosts[socket.bracket_id] = socket.id;
      socket.join(socket.bracket_id);
      console.log(`Host joined round ${socket.bracket_id}`);

      socket.on('viewer-joined', (viewerId) => {
        console.log(`Host notified of viewer ${viewerId}`);
      });

    } else if (socket.streamRole === 'viewer') {
      socket.join(socket.bracket_id);
      const hostSocketId = hosts[socket.bracket_id];
      if (hostSocketId) {
        io.to(hostSocketId).emit('viewer-joined', socket.id);
        console.log(`Viewer ${socket.id} joined round ${socket.bracket_id}`);
      } else {
        console.log(`Viewer ${socket.id} joined round ${socket.bracket_id}, but no host present`);
      }
    } else {
      socket.disconnect(true);
      return;
    }

    socket.on('offer', ({ viewerId, sdp }) => {
      io.to(viewerId).emit('offer', { sdp, hostId: socket.id });
    });

    socket.on('answer', ({ hostId, sdp }) => {
      io.to(hostId).emit('answer', { sdp, viewerId: socket.id });
    });

    socket.on('ice-candidate', ({ targetId, candidate }) => {
      io.to(targetId).emit('ice-candidate', { candidate, fromId: socket.id });
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      if (socket.streamRole === 'host' && hosts[socket.bracket_id] === socket.id) {
        delete hosts[socket.bracket_id];
        console.log(`Host for round ${socket.bracket_id} disconnected`);

        try {
          // Only set inactive if the host disconnects
          await StreamToken.update(
            { isActive: false },
            { where: { token: socket.token } }
          );
        } catch (err) {
          console.error(`Failed to update token status:`, err.message);
        }
      }
    });
  });
}

module.exports = { setupSocket };
