/*
  Warnings:

  - Added the required column `value` to the `Action` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Interaction" ADD VALUE 'GOTO';

-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "value" TEXT NOT NULL;
