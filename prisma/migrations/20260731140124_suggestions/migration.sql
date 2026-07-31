-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'vi');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'HANDLED');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "selectedText" TEXT NOT NULL,
    "contextBefore" TEXT NOT NULL,
    "contextAfter" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_pagePath_status_idx" ON "Suggestion"("pagePath", "status");

-- CreateIndex
CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt");
