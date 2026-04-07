import { Request } from 'express';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  description?: string;
  currentStock?: number;
  minStock?: number;
  purchasePrice: number;
  salePrice: number;
  categoryId: string;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  description?: string;
  currentStock?: number;
  minStock?: number;
  purchasePrice?: number;
  salePrice?: number;
  categoryId?: string;
}

export interface CreateSaleInput {
  customerName: string;
  customerRuc?: string;
  wantsInvoice?: boolean;
  items: {
    productId: string;
    quantity: number;
  }[];
}

export interface CreatePurchaseInput {
  supplier?: string;
  invoiceNumber?: string;
  items: {
    productId: string;
    quantity: number;
    unitCost: number;
  }[];
}
