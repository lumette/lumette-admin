-- 승인 전 실행 금지: production 최초 테이블 생성 계획 (기존 데이터 삭제 없음)
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('UNKNOWN', 'ACTIVE', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('UNMAPPED', 'MATCHED', 'NEEDS_REVIEW', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "OptionIdentitySource" AS ENUM ('BARCODE_CANDIDATE', 'EXTERNAL_ID_CONFIRMED', 'MANUAL');

-- CreateEnum
CREATE TYPE "OptionRule" AS ENUM ('SIZE_ONLY_SILVER', 'COLOR_AND_SIZE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('NAVER', 'SILVERTHERAPY', 'MAPPING');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('PRODUCT_NAME', 'BASE_PRICE', 'PRODUCT_STATUS', 'OPTION_PRICE', 'OPTION_NAME', 'OPTION_BARCODE', 'OPTION_WEIGHT', 'OPTION_ADDED', 'OPTION_REMOVED', 'OPTION_STATUS');

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,
    "originProductNo" TEXT NOT NULL,
    "channelProductNos" JSONB NOT NULL DEFAULT '[]',
    "manufactureDefineNo" TEXT,
    "name" TEXT NOT NULL,
    "salePrice" DECIMAL(18,2) NOT NULL,
    "naverStatus" TEXT NOT NULL,
    "categoryCode" TEXT,
    "mappingSuffix" TEXT,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'UNMAPPED',
    "mappingReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProductOption" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "naverOptionId" TEXT NOT NULL,
    "groupValues" JSONB NOT NULL,
    "rawName" TEXT NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "priceAdjustment" DECIMAL(18,2) NOT NULL,
    "stockQuantity" INTEGER,
    "usable" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT 'silvertherapy',
    "itId" TEXT NOT NULL,
    "name" TEXT,
    "basePrice" DECIMAL(18,2),
    "status" "SupplierStatus" NOT NULL DEFAULT 'UNKNOWN',
    "hasBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductOption" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "identitySource" "OptionIdentitySource" NOT NULL,
    "externalOptionId" TEXT,
    "barcode" TEXT,
    "rawName" TEXT NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "supplyPrice" DECIMAL(18,2) NOT NULL,
    "weight" DECIMAL(12,4),
    "weightUnit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMapping" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT 'silvertherapy',
    "matchKey" TEXT NOT NULL,
    "status" "MappingStatus" NOT NULL DEFAULT 'MATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionMapping" (
    "id" TEXT NOT NULL,
    "productMappingId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "storeProductOptionId" TEXT NOT NULL,
    "supplierProductOptionId" TEXT NOT NULL,
    "rule" "OptionRule" NOT NULL,
    "status" "MappingStatus" NOT NULL DEFAULT 'MATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChangeLog" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "supplierProductOptionId" TEXT,
    "syncHistoryId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" "ChangeType" NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncHistory" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT,
    "source" "SyncSource" NOT NULL,
    "supplier" TEXT,
    "storeProductId" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreProduct_storeKey_manufactureDefineNo_idx" ON "StoreProduct"("storeKey", "manufactureDefineNo");

-- CreateIndex
CREATE INDEX "StoreProduct_categoryCode_mappingSuffix_idx" ON "StoreProduct"("categoryCode", "mappingSuffix");

-- CreateIndex
CREATE INDEX "StoreProduct_mappingStatus_updatedAt_idx" ON "StoreProduct"("mappingStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_storeKey_originProductNo_key" ON "StoreProduct"("storeKey", "originProductNo");

-- CreateIndex
CREATE INDEX "StoreProductOption_storeProductId_active_idx" ON "StoreProductOption"("storeProductId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProductOption_storeProductId_naverOptionId_key" ON "StoreProductOption"("storeProductId", "naverOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProductOption_id_storeProductId_key" ON "StoreProductOption"("id", "storeProductId");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplier_status_idx" ON "SupplierProduct"("supplier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_supplier_itId_key" ON "SupplierProduct"("supplier", "itId");

-- CreateIndex
CREATE INDEX "SupplierProductOption_supplierProductId_barcode_idx" ON "SupplierProductOption"("supplierProductId", "barcode");

-- CreateIndex
CREATE INDEX "SupplierProductOption_supplierProductId_active_idx" ON "SupplierProductOption"("supplierProductId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProductOption_supplierProductId_identityKey_key" ON "SupplierProductOption"("supplierProductId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProductOption_id_supplierProductId_key" ON "SupplierProductOption"("id", "supplierProductId");

-- CreateIndex
CREATE INDEX "ProductMapping_supplierProductId_idx" ON "ProductMapping"("supplierProductId");

-- CreateIndex
CREATE INDEX "ProductMapping_matchKey_idx" ON "ProductMapping"("matchKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_storeProductId_supplier_key" ON "ProductMapping"("storeProductId", "supplier");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_id_storeProductId_supplierProductId_key" ON "ProductMapping"("id", "storeProductId", "supplierProductId");

-- CreateIndex
CREATE INDEX "OptionMapping_storeProductOptionId_storeProductId_idx" ON "OptionMapping"("storeProductOptionId", "storeProductId");

-- CreateIndex
CREATE INDEX "OptionMapping_supplierProductOptionId_supplierProductId_idx" ON "OptionMapping"("supplierProductOptionId", "supplierProductId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionMapping_productMappingId_storeProductOptionId_key" ON "OptionMapping"("productMappingId", "storeProductOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionMapping_productMappingId_supplierProductOptionId_key" ON "OptionMapping"("productMappingId", "supplierProductOptionId");

-- CreateIndex
CREATE INDEX "ProductChangeLog_createdAt_id_idx" ON "ProductChangeLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ProductChangeLog_supplierProductId_createdAt_idx" ON "ProductChangeLog"("supplierProductId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductChangeLog_supplierProductOptionId_supplierProductId_idx" ON "ProductChangeLog"("supplierProductOptionId", "supplierProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductChangeLog_syncHistoryId_eventKey_key" ON "ProductChangeLog"("syncHistoryId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyncHistory_requestKey_key" ON "SyncHistory"("requestKey");

-- CreateIndex
CREATE INDEX "SyncHistory_source_startedAt_idx" ON "SyncHistory"("source", "startedAt");

-- CreateIndex
CREATE INDEX "SyncHistory_storeProductId_startedAt_idx" ON "SyncHistory"("storeProductId", "startedAt");

-- AddForeignKey
ALTER TABLE "StoreProductOption" ADD CONSTRAINT "StoreProductOption_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductOption" ADD CONSTRAINT "SupplierProductOption_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionMapping" ADD CONSTRAINT "OptionMapping_productMappingId_storeProductId_supplierProd_fkey" FOREIGN KEY ("productMappingId", "storeProductId", "supplierProductId") REFERENCES "ProductMapping"("id", "storeProductId", "supplierProductId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionMapping" ADD CONSTRAINT "OptionMapping_storeProductOptionId_storeProductId_fkey" FOREIGN KEY ("storeProductOptionId", "storeProductId") REFERENCES "StoreProductOption"("id", "storeProductId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionMapping" ADD CONSTRAINT "OptionMapping_supplierProductOptionId_supplierProductId_fkey" FOREIGN KEY ("supplierProductOptionId", "supplierProductId") REFERENCES "SupplierProductOption"("id", "supplierProductId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_supplierProductOptionId_supplierProductId_fkey" FOREIGN KEY ("supplierProductOptionId", "supplierProductId") REFERENCES "SupplierProductOption"("id", "supplierProductId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_syncHistoryId_fkey" FOREIGN KEY ("syncHistoryId") REFERENCES "SyncHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncHistory" ADD CONSTRAINT "SyncHistory_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;

