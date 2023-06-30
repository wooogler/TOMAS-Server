/*
  Warnings:

  - Added the required column `description` to the `Component` table without a default value. This is not possible if the table is not empty.
  - Added the required column `i` to the `Component` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Component` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Component" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "i" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;
