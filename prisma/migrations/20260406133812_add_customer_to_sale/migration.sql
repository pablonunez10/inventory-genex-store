-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerName" TEXT NOT NULL DEFAULT 'Cliente',
ADD COLUMN     "customerRuc" TEXT,
ADD COLUMN     "wantsInvoice" BOOLEAN NOT NULL DEFAULT false;

-- Remove default after migration
ALTER TABLE "Sale" ALTER COLUMN "customerName" DROP DEFAULT;
