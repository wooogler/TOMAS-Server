/*
  Warnings:

  - Added the required column `type` to the `Action` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Interaction" AS ENUM ('SCROLL', 'CLICK', 'INPUT', 'HOVER', 'BACK');

-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "type" "Interaction" NOT NULL;
