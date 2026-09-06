-- The organising committee, for the public Team page.
--
-- Two tables rather than a department name on each member: a department is
-- renamed once, ordered once, and described once, and doing that across every
-- member row would be a mass update that half-fails.
--
-- ON DELETE SET NULL rather than CASCADE on the member link. Deleting a
-- department is a reorganisation, not a dismissal — the people are still on the
-- committee, and losing them because their department was renamed away would be
-- a genuinely bad surprise. They surface under "not in a department" until
-- somebody reassigns them.
CREATE TABLE "CommitteeDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "rank" TEXT NOT NULL DEFAULT 'MEMBER',
    "departmentId" TEXT,
    "photoUrl" TEXT,
    "photoKey" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommitteeMember_departmentId_idx" ON "CommitteeMember"("departmentId");
CREATE INDEX "CommitteeMember_isPublished_idx" ON "CommitteeMember"("isPublished");

ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "CommitteeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
