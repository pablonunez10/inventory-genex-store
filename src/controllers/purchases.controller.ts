import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, CreatePurchaseInput } from '../types';

const prisma = new PrismaClient();

export const createPurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data: CreatePurchaseInput = req.body;

    if (!data.items || data.items.length === 0) {
      res.status(400).json({ error: 'Debe incluir al menos un producto' });
      return;
    }

    // Verificar que todos los productos existen
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        res.status(400).json({ error: `Producto ${item.productId} no encontrado` });
        return;
      }

      if (!product.isActive) {
        res.status(400).json({ error: `Producto ${product.name} no está activo` });
        return;
      }

      if (item.quantity <= 0) {
        res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
        return;
      }

      if (item.unitCost <= 0) {
        res.status(400).json({ error: 'El costo unitario debe ser mayor a 0' });
        return;
      }
    }

    // Obtener stocks actuales
    const itemsWithStock = await Promise.all(
      data.items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.quantity * item.unitCost,
          currentStock: product!.currentStock,
        };
      })
    );

    const totalAmount = itemsWithStock.reduce((sum, item) => sum + item.subtotal, 0);

    // Crear compra y actualizar stock en transacción
    const purchase = await prisma.$transaction(async (tx) => {
      // Crear la orden de compra
      const newPurchase = await tx.purchaseOrder.create({
        data: {
          supplier: data.supplier,
          invoiceNumber: data.invoiceNumber,
          totalAmount,
          createdById: req.user!.userId,
          items: {
            create: itemsWithStock.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });

      // Actualizar stock y crear movimientos
      for (const item of itemsWithStock) {
        const newStock = item.currentStock + item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: newStock },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            movementType: 'PURCHASE',
            quantity: item.quantity,
            previousStock: item.currentStock,
            newStock,
            notes: `Compra #${newPurchase.id}`,
          },
        });
      }

      return newPurchase;
    });

    res.status(201).json(purchase);
  } catch (error) {
    console.error('Error creando compra:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getPurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) {
        where.purchaseDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.purchaseDate.lte = new Date(endDate as string);
      }
    }

    const purchases = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });

    res.json(purchases);
  } catch (error) {
    console.error('Error obteniendo compras:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getPurchaseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, category: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!purchase) {
      res.status(404).json({ error: 'Compra no encontrada' });
      return;
    }

    res.json(purchase);
  } catch (error) {
    console.error('Error obteniendo compra:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
