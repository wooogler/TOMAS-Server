/*
  Warnings:

  - You are about to drop the column `html` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `html` on the `Screen` table. All the data in the column will be lost.
  - Added the required column `rawhtml` to the `Component` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawhtml` to the `Screen` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Component" DROP COLUMN "html",
ADD COLUMN     "rawhtml" TEXT NOT NULL,
ADD COLUMN     "simpleHtml" TEXT;

-- AlterTable
ALTER TABLE "Screen" DROP COLUMN "html",
ADD COLUMN     "rawhtml" TEXT NOT NULL;
