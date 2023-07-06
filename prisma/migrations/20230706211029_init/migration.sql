-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "Interaction" AS ENUM ('GOTO', 'SCROLL', 'CLICK', 'INPUT', 'HOVER', 'BACK');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('button', 'link', 'input_radio', 'input_text', 'input_button', 'list');

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "Role" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rawHtml" TEXT NOT NULL,
    "simpleHtml" TEXT NOT NULL,
    "prevActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "description" TEXT NOT NULL,
    "i" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vector" vector,
    "screenId" TEXT,
    "onActionId" TEXT,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "type" "Interaction" NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Screen_prevActionId_key" ON "Screen"("prevActionId");

-- CreateIndex
CREATE UNIQUE INDEX "Component_onActionId_key" ON "Component"("onActionId");

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_prevActionId_fkey" FOREIGN KEY ("prevActionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_onActionId_fkey" FOREIGN KEY ("onActionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
