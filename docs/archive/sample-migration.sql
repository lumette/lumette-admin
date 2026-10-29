-- Archived, never applied: superseded sample-only schema.
BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'SOLD_OUT', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ChangeField" AS ENUM ('PRICE', 'STATUS', 'NAME');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMapping" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChangeLog" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "syncHistoryId" TEXT NOT NULL,
    "field" "ChangeField" NOT NULL,
    "previousValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncHistory" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT true,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_isSample_createdAt_idx" ON "Product"("isSample", "createdAt");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "SupplierProduct_isSample_updatedAt_idx" ON "SupplierProduct"("isSample", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_supplier_externalId_key" ON "SupplierProduct"("supplier", "externalId");

-- CreateIndex
CREATE INDEX "ProductMapping_supplierProductId_idx" ON "ProductMapping"("supplierProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_productId_supplierProductId_key" ON "ProductMapping"("productId", "supplierProductId");

-- CreateIndex
CREATE INDEX "ProductChangeLog_createdAt_id_idx" ON "ProductChangeLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ProductChangeLog_supplierProductId_createdAt_idx" ON "ProductChangeLog"("supplierProductId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductChangeLog_syncHistoryId_supplierProductId_field_key" ON "ProductChangeLog"("syncHistoryId", "supplierProductId", "field");

-- CreateIndex
CREATE INDEX "SyncHistory_supplier_startedAt_idx" ON "SyncHistory"("supplier", "startedAt");

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_syncHistoryId_fkey" FOREIGN KEY ("syncHistoryId") REFERENCES "SyncHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;

