/*
  Warnings:

  - You are about to drop the `Element` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Element" DROP CONSTRAINT "Element_onActionId_fkey";

-- DropForeignKey
ALTER TABLE "Element" DROP CONSTRAINT "Element_screenId_fkey";

-- DropTable
DROP TABLE "Element";

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "screenId" TEXT,
    "onActionId" TEXT,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Component_onActionId_key" ON "Component"("onActionId");

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_onActionId_fkey" FOREIGN KEY ("onActionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
