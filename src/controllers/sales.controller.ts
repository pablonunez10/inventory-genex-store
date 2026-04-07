import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, CreateSaleInput } from '../types';

const prisma = new PrismaClient();

export const createSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data: CreateSaleInput = req.body;

    if (!data.customerName || data.customerName.trim() === '') {
      res.status(400).json({ error: 'El nombre del cliente es requerido' });
      return;
    }

    if (!data.items || data.items.length === 0) {
      res.status(400).json({ error: 'Debe incluir al menos un producto' });
      return;
    }

    // Verificar stock disponible para todos los productos
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        res.status(400).json({ error: `Producto ${item.productId} no encontrado` });
        return;
      }

      if (!product.isActive) {
        res.status(400).json({ error: `Producto ${product.name} no está disponible` });
        return;
      }

      if (product.currentStock < item.quantity) {
        res.status(400).json({
          error: `Stock insuficiente para ${product.name}. Disponible: ${product.currentStock}`
        });
        return;
      }
    }

    // Obtener precios y calcular total
    const itemsWithPrices = await Promise.all(
      data.items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(product!.salePrice),
          subtotal: item.quantity * Number(product!.salePrice),
          currentStock: product!.currentStock,
        };
      })
    );

    const totalAmount = itemsWithPrices.reduce((sum, item) => sum + item.subtotal, 0);

    // Crear venta y actualizar stock en transacción
    const sale = await prisma.$transaction(async (tx) => {
      // Crear la venta
      const newSale = await tx.sale.create({
        data: {
          customerName: data.customerName.trim(),
          customerRuc: data.customerRuc?.trim() || null,
          wantsInvoice: data.wantsInvoice || false,
          totalAmount,
          createdById: req.user!.userId,
          items: {
            create: itemsWithPrices.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
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
      for (const item of itemsWithPrices) {
        const newStock = item.currentStock - item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: newStock },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            movementType: 'SALE',
            quantity: -item.quantity,
            previousStock: item.currentStock,
            newStock,
            notes: `Venta #${newSale.id}`,
          },
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (error) {
    console.error('Error creando venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) {
        where.saleDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.saleDate.lte = new Date(endDate as string);
      }
    }

    const sales = await prisma.sale.findMany({
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
      orderBy: { saleDate: 'desc' },
    });

    res.json(sales);
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getMySales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sales = await prisma.sale.findMany({
      where: { createdById: req.user!.userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    res.json(sales);
  } catch (error) {
    console.error('Error obteniendo mis ventas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSaleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const sale = await prisma.sale.findUnique({
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

    if (!sale) {
      res.status(404).json({ error: 'Venta no encontrada' });
      return;
    }

    res.json(sale);
  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSalesReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query;

    if (!date) {
      res.status(400).json({ error: 'Fecha es requerida (formato: YYYY-MM-DD)' });
      return;
    }

    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, purchasePrice: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalCost = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => {
        return itemSum + item.quantity * Number(item.product.purchasePrice);
      }, 0);
    }, 0);
    const totalProfit = totalRevenue - totalCost;

    res.json({
      date: date as string,
      totalSales,
      totalRevenue,
      totalCost,
      totalProfit,
      sales,
    });
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
