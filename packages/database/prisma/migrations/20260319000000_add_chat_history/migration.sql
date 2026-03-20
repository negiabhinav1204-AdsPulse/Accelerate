-- Add ChatSession and ChatMessage tables for persistent AI chat history

CREATE TABLE IF NOT EXISTS "ChatSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_ChatSession" PRIMARY KEY ("id"),
  CONSTRAINT "FK_ChatSession_organizationId" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FK_ChatSession_userId" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_ChatSession_organizationId" ON "ChatSession"("organizationId");
CREATE INDEX IF NOT EXISTS "IX_ChatSession_userId" ON "ChatSession"("userId");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "toolData" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_ChatMessage" PRIMARY KEY ("id"),
  CONSTRAINT "FK_ChatMessage_sessionId" FOREIGN KEY ("sessionId")
    REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_ChatMessage_sessionId" ON "ChatMessage"("sessionId");
