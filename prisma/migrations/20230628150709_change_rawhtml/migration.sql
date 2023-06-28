/*
  Warnings:

  - You are about to drop the column `rawhtml` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `rawhtml` on the `Screen` table. All the data in the column will be lost.
  - Added the required column `rawHtml` to the `Component` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawHtml` to the `Screen` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Component" DROP COLUMN "rawhtml",
ADD COLUMN     "rawHtml" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Screen" DROP COLUMN "rawhtml",
ADD COLUMN     "rawHtml" TEXT NOT NULL;
