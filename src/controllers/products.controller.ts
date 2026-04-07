import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, CreateProductInput, UpdateProductInput } from '../types';

const prisma = new PrismaClient();

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, categoryId, lowStock } = req.query;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId as string;
    }

    if (lowStock === 'true') {
      where.currentStock = { lte: prisma.product.fields.minStock };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filtrar stock bajo manualmente si se solicitó
    let result = products;
    if (lowStock === 'true') {
      result = products.filter(p => p.currentStock <= p.minStock);
    }

    res.json(result);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data: CreateProductInput = req.body;

    if (!data.name || !data.sku || !data.salePrice || !data.categoryId || data.purchasePrice === undefined) {
      res.status(400).json({
        error: 'Nombre, SKU, precio de compra, precio de venta y categoría son requeridos'
      });
      return;
    }

    // Verificar que la categoría existe
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      res.status(400).json({ error: 'Categoría no encontrada' });
      return;
    }

    // Verificar que el SKU no exista
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingProduct) {
      res.status(400).json({ error: 'El SKU ya existe' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        currentStock: data.currentStock || 0,
        minStock: data.minStock || 5,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        categoryId: data.categoryId,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const data: UpdateProductInput = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    // Si se está actualizando el SKU, verificar que no exista
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { sku: data.sku },
      });

      if (skuExists) {
        res.status(400).json({ error: 'El SKU ya existe' });
        return;
      }
    }

    // Si se está actualizando la categoría, verificar que exista
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        res.status(400).json({ error: 'Categoría no encontrada' });
        return;
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(product);
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { quantity, notes } = req.body;

    if (quantity === undefined || typeof quantity !== 'number') {
      res.status(400).json({ error: 'Cantidad es requerida y debe ser un número' });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    const newStock = product.currentStock + quantity;

    if (newStock < 0) {
      res.status(400).json({ error: 'El stock no puede ser negativo' });
      return;
    }

    const [updatedProduct] = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { currentStock: newStock },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.inventoryMovement.create({
        data: {
          productId: id,
          movementType: 'ADJUSTMENT',
          quantity,
          previousStock: product.currentStock,
          newStock,
          notes,
        },
      }),
    ]);

    res.json(updatedProduct);
  } catch (error) {
    console.error('Error ajustando stock:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
    });

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStockCount = products.filter(p => p.currentStock <= p.minStock).length;
    const totalInventoryValue = products.reduce(
      (sum, p) => sum + p.currentStock * Number(p.salePrice),
      0
    );
    const totalCostValue = products.reduce(
      (sum, p) => sum + p.currentStock * Number(p.purchasePrice),
      0
    );

    res.json({
      totalProducts,
      totalStock,
      lowStockCount,
      totalInventoryValue,
      totalCostValue,
      potentialProfit: totalInventoryValue - totalCostValue,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
