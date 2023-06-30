/*
  Warnings:

  - Made the column `simpleHtml` on table `Component` required. This step will fail if there are existing NULL values in that column.
  - Made the column `simpleHtml` on table `Screen` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Component" ALTER COLUMN "simpleHtml" SET NOT NULL;

-- AlterTable
ALTER TABLE "Screen" ALTER COLUMN "simpleHtml" SET NOT NULL;
