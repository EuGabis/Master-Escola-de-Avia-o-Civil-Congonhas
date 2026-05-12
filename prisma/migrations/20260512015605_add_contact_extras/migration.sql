-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "courseInterest" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'lead';

-- CreateIndex
CREATE INDEX "Contact_workspaceId_status_idx" ON "Contact"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_courseInterest_idx" ON "Contact"("workspaceId", "courseInterest");
