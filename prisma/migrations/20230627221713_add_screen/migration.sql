-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "simpleHtml" TEXT,
    "prevActionId" TEXT,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Element" (
    "id" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "screenId" TEXT,
    "onActionId" TEXT,

    CONSTRAINT "Element_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Screen_prevActionId_key" ON "Screen"("prevActionId");

-- CreateIndex
CREATE UNIQUE INDEX "Element_onActionId_key" ON "Element"("onActionId");

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_prevActionId_fkey" FOREIGN KEY ("prevActionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_onActionId_fkey" FOREIGN KEY ("onActionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
