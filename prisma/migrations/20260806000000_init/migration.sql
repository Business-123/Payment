-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "api_secret" TEXT NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paystack_access_code" TEXT,
    "authorization_url" TEXT,
    "redirect_url" TEXT,
    "metadata" JSONB,
    "merchant_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_type" TEXT NOT NULL,
    "reference" TEXT,
    "raw_payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_api_key_key" ON "merchants"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_idx" ON "transactions"("merchant_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
