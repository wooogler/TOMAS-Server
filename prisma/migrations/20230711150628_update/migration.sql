/*
  Warnings:

  - You are about to drop the column `description` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `vector` on the `Component` table. All the data in the column will be lost.
  - Added the required column `description` to the `Chat` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Component` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `description` to the `Screen` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "vector" vector;

-- AlterTable
ALTER TABLE "Component" DROP COLUMN "description",
DROP COLUMN "vector",
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Screen" ADD COLUMN     "description" TEXT NOT NULL;

-- DropEnum
DROP TYPE "ComponentType";
