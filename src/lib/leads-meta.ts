import type { BadgeProps } from "@/components/ui/badge"
import type { LeadSource, LeadStage } from "@/lib/db/schema"

type StageMeta = {
  label: string
  variant: BadgeProps["variant"]
}

export const STAGE_META: Record<LeadStage, StageMeta> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "secondary" },
  qualified: { label: "Qualified", variant: "secondary" },
  proposal: { label: "Proposal", variant: "warning" },
  negotiation: { label: "Negotiation", variant: "warning" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "destructive" },
}

/** Pipeline order for the kanban board (won/lost at the end). */
export const BOARD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  referral: "Referral",
  whatsapp: "WhatsApp",
  cold_call: "Cold Call",
  campaign: "Campaign",
  other: "Other",
}

export const ACTIVITY_ICONS: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  status_change: "Stage",
  assignment: "Assignment",
  system: "System",
  whatsapp: "WhatsApp",
}
