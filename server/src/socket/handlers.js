import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export function setupSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId,
          isActive: true
        },
        select: {
          id: true,
          username: true,
          role: true,
          depotId: true
        }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {


    socket.on('join_depot', (data) => {
      const { depotId } = data;
      socket.join(`depot_${depotId}`);

    });

    socket.on('leave_depot', (data) => {
      const { depotId } = data;
      socket.leave(`depot_${depotId}`);

    });


    socket.on('stock_update', (data) => {
      const { depotId, productId, quantity } = data;
      io.to(`depot_${depotId}`).emit('stock_updated', {
        productId,
        quantity,
        updatedBy: socket.user.username,
        updatedAt: new Date()
      });
    });

    socket.on('sale_created', (data) => {
      const { depotId, sale } = data;
      io.to(`depot_${depotId}`).emit('sale_created', {
        sale,
        createdBy: socket.user.username,
        createdAt: new Date()
      });
    });

    socket.on('disconnect', () => {

    });
  });
} 