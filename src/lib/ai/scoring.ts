import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"

import { getModel, isAIConfigured } from "@/lib/ai/provider"
import { db } from "@/lib/db"
import { aiInsights, leads, type Lead, type LeadStage } from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"

const log = childLogger({ module: "ai-scoring" })

const OPEN_STAGES: LeadStage[] = ["new", "contacted", "qualified", "proposal", "negotiation"]

/**
 * Deterministic heuristic score (0–100) — always available, no API key needed.
 * Signals: stage progress, deal value, recency of contact, follow-up hygiene.
 */
export function heuristicScore(lead: Lead): number {
  const stageWeights: Record<LeadStage, number> = {
    new: 10,
    contacted: 25,
    qualified: 40,
    proposal: 55,
    negotiation: 70,
    won: 100,
    lost: 0,
  }
  let score = stageWeights[lead.stage] ?? 10

  // Value signal: up to +15 for deals ≥ ₹5L (50,000,000 paise).
  if (lead.value > 0) {
    score += Math.min(15, Math.round((lead.value / 50_000_000) * 15))
  }

  // Recency: last contact within 7d +10, within 30d +5, stale −15.
  if (lead.lastContactedAt) {
    const days = (Date.now() - lead.lastContactedAt.getTime()) / 86_400_000
    if (days <= 7) score += 10
    else if (days <= 30) score += 5
    else score -= 15
  } else {
    score -= 5
  }

  // Follow-up scheduled = intent.
  if (lead.nextFollowUpAt && lead.nextFollowUpAt > new Date()) score += 5

  return Math.max(0, Math.min(100, score))
}

export type ScoredLead = {
  leadId: string
  leadName: string
  score: number
  rationale: string
}

/** Scores a batch of open leads; LLM rationale when configured, heuristic otherwise. */
export async function scoreLeads(limit = 100): Promise<ScoredLead[]> {
  const openLeads = await db
    .select()
    .from(leads)
    .where(and(isNull(leads.deletedAt), inArray(leads.stage, OPEN_STAGES)))
    .orderBy(desc(leads.createdAt))
    .limit(limit)

  if (openLeads.length === 0) return []

  const useLLM = isAIConfigured()
  const results: ScoredLead[] = []

  for (const lead of openLeads) {
    let score = heuristicScore(lead)
    let rationale = heuristicRationale(lead)

    if (useLLM) {
      try {
        const llm = await llmScore(lead, score)
        if (llm) {
          score = llm.score
          rationale = llm.rationale
        }
      } catch (error) {
        log.warn({ err: error, leadId: lead.id }, "LLM scoring failed — using heuristic")
      }
    }

    results.push({ leadId: lead.id, leadName: lead.name, score, rationale })

    await db.update(leads).set({ aiScore: score }).where(eq(leads.id, lead.id))
    await db.insert(aiInsights).values({
      type: "lead_score",
      entityType: "lead",
      entityId: lead.id,
      score,
      title: `Lead score: ${lead.name}`,
      body: rationale,
      payload: { stage: lead.stage, value: lead.value },
      modelVersion: useLLM ? (process.env.AI_MODEL ?? "gpt-4o-mini") : "heuristic-v1",
    })
  }

  log.info({ count: results.length, llm: useLLM }, "leads scored")
  return results
}

function heuristicRationale(lead: Lead): string {
  const parts: string[] = [`Stage ${lead.stage}`]
  if (lead.value > 0) parts.push(`deal value ₹${(lead.value / 100).toLocaleString("en-IN")}`)
  if (lead.lastContactedAt) {
    const days = Math.floor((Date.now() - lead.lastContactedAt.getTime()) / 86_400_000)
    parts.push(days <= 7 ? "recently contacted" : `last contacted ${days}d ago`)
  } else {
    parts.push("never contacted")
  }
  if (lead.nextFollowUpAt) parts.push("follow-up scheduled")
  return parts.join(" · ")
}

async function llmScore(
  lead: Lead,
  heuristic: number
): Promise<{ score: number; rationale: string } | null> {
  const model = await getModel()
  const { generateObject } = await import("ai")
  const { z } = await import("zod")

  const { object } = await generateObject({
    model,
    schema: z.object({
      score: z.number().int().min(0).max(100),
      rationale: z.string().max(300),
    }),
    prompt: [
      `Score this B2B sales lead's likelihood to close (0–100).`,
      `Heuristic baseline: ${heuristic}.`,
      `Name: ${lead.name}; company: ${lead.company ?? "—"}; stage: ${lead.stage};`,
      `value(paise): ${lead.value}; source: ${lead.source};`,
      `lastContactedAt: ${lead.lastContactedAt?.toISOString() ?? "never"};`,
      `nextFollowUpAt: ${lead.nextFollowUpAt?.toISOString() ?? "none"};`,
      `notes: ${lead.notes?.slice(0, 500) ?? "—"}.`,
      `One-sentence rationale grounded in the data.`,
    ].join(" "),
  })

  return object
}

/** Weekly pipeline summary insight (LLM when configured, template otherwise). */
export async function generateWeeklySummary(): Promise<string> {
  const stats = await db
    .select({
      stage: leads.stage,
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${leads.value}), 0)::bigint`,
    })
    .from(leads)
    .where(isNull(leads.deletedAt))
    .groupBy(leads.stage)

  const totalOpen = stats
    .filter((s) => !["won", "lost"].includes(s.stage))
    .reduce((a, s) => a + Number(s.count), 0)
  const won = stats.find((s) => s.stage === "won")
  const pipelineValue = stats
    .filter((s) => !["won", "lost"].includes(s.stage))
    .reduce((a, s) => a + Number(s.total), 0)

  const fallback =
    `Pipeline: ${totalOpen} open leads worth ₹${(pipelineValue / 100).toLocaleString("en-IN")}. ` +
    `Won to date: ${Number(won?.count ?? 0)} deals. ` +
    `Top stage: ${[...stats].sort((a, b) => Number(b.count) - Number(a.count))[0]?.stage ?? "n/a"}.`

  if (!isAIConfigured()) return fallback

  try {
    const model = await getModel()
    const { generateText } = await import("ai")
    const { text } = await generateText({
      model,
      system:
        "You are a sales ops analyst. Write a tight 3-sentence weekly pipeline summary for the founder. Be specific with numbers.",
      prompt: JSON.stringify(stats),
    })
    return text
  } catch (error) {
    log.warn({ err: error }, "LLM summary failed — using template")
    return fallback
  }
}
