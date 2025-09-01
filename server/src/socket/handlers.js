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
    console.log(`User ${socket.user.username} connected`);

    socket.on('join_depot', (data) => {
      const { depotId } = data;
      socket.join(`depot_${depotId}`);
      console.log(`User ${socket.user.username} joined depot ${depotId}`);
    });

    socket.on('leave_depot', (data) => {
      const { depotId } = data;
      socket.leave(`depot_${depotId}`);
      console.log(`User ${socket.user.username} left depot ${depotId}`);
    });

    socket.on('request_transfer', async (data) => {
      try {
        const { fromDepotId, toDepotId, items, notes } = data;

        const transfer = await prisma.stockTransfer.create({
          data: {
            fromDepotId: parseInt(fromDepotId),
            toDepotId: parseInt(toDepotId),
            requestedBy: socket.user.id,
            notes
          }
        });

        for (const item of items) {
          await prisma.stockTransferItem.create({
            data: {
              transferId: transfer.id,
              productId: item.productId,
              quantity: item.quantity
            }
          });
        }

        const transferData = {
          id: transfer.id,
          fromDepotId,
          toDepotId,
          items,
          notes,
          requestedBy: socket.user.id,
          status: 'PENDING',
          requestedAt: transfer.requestedAt
        };

        io.to(`depot_${fromDepotId}`).to(`depot_${toDepotId}`).emit('transfer_request', transferData);
        
        console.log(`Transfer request created: ${transfer.id}`);
      } catch (error) {
        console.error('Error creating transfer request:', error);
        socket.emit('error', { message: 'Failed to create transfer request' });
      }
    });

    socket.on('approve_transfer', async (data) => {
      try {
        const { transferId, approved } = data;

        if (approved) {
          await prisma.stockTransfer.update({
            where: { id: parseInt(transferId) },
            data: {
              status: 'APPROVED',
              approvedBy: socket.user.id,
              approvedAt: new Date()
            }
          });

          const transferData = {
            transferId,
            approvedBy: socket.user.id,
            approvedAt: new Date()
          };

          io.emit('transfer_approved', transferData);
          console.log(`Transfer ${transferId} approved by ${socket.user.username}`);
        } else {
          await prisma.stockTransfer.update({
            where: { id: parseInt(transferId) },
            data: { status: 'CANCELLED' }
          });

          const transferData = {
            transferId,
            cancelledBy: socket.user.id,
            cancelledAt: new Date()
          };

          io.emit('transfer_cancelled', transferData);
          console.log(`Transfer ${transferId} cancelled by ${socket.user.username}`);
        }
      } catch (error) {
        console.error('Error approving transfer:', error);
        socket.emit('error', { message: 'Failed to approve transfer' });
      }
    });

    socket.on('complete_transfer', async (data) => {
      try {
        const { transferId } = data;

        await prisma.$transaction(async (tx) => {
          await tx.stockTransfer.update({
            where: { id: parseInt(transferId) },
            data: {
              status: 'TRANSFERRED',
              transferredAt: new Date()
            }
          });

          const transferItems = await tx.stockTransferItem.findMany({
            where: { transferId: parseInt(transferId) }
          });

          const transfer = await tx.stockTransfer.findUnique({
            where: { id: parseInt(transferId) }
          });

          for (const item of transferItems) {
            await tx.inventory.updateMany({
              where: {
                depotId: transfer.fromDepotId,
                productId: item.productId
              },
              data: {
                quantity: {
                  decrement: item.quantity
                }
              }
            });

            await tx.inventory.updateMany({
              where: {
                depotId: transfer.toDepotId,
                productId: item.productId
              },
              data: {
                quantity: {
                  increment: item.quantity
                }
              }
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                depotId: transfer.fromDepotId,
                quantity: item.quantity,
                type: 'TRANSFER',
                fromDepotId: transfer.fromDepotId,
                toDepotId: transfer.toDepotId,
                reason: 'Stock transfer',
                userId: socket.user.id
              }
            });
          }
        });

        const transferData = {
          transferId,
          completedBy: socket.user.id,
          completedAt: new Date()
        };

        io.emit('transfer_completed', transferData);
        console.log(`Transfer ${transferId} completed by ${socket.user.username}`);
      } catch (error) {
        console.error('Error completing transfer:', error);
        socket.emit('error', { message: 'Failed to complete transfer' });
      }
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
      console.log(`User ${socket.user.username} disconnected`);
    });
  });
} 