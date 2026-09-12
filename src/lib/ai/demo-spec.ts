import type { DashboardSpec } from "@/lib/ai/widget-schema"

/**
 * Sample board used to showcase the visual analytics feature when no
 * AI provider is configured. Real data replaces it once OPENAI_API_KEY is set.
 */
export const DEMO_SPEC: DashboardSpec = {
  title: "CRM analytics — last 15 days",
  subtitle:
    "Demo preview: this is exactly how the assistant would draw a live board. Hover the bars, compare the trend line, and check the leaderboard.",
  periodLabel: "Last 15 days",
  widgets: [
    {
      type: "kpi",
      label: "New leads",
      value: "37",
      delta: { text: "12 vs prior 15d", direction: "up", tone: "positive" },
      sublabel: "Across website, WhatsApp and referrals",
    },
    {
      type: "kpi",
      label: "Win rate",
      value: "32.4%",
      delta: { text: "+2.1 pts", direction: "up", tone: "positive" },
      sublabel: "9 of 37 leads created this period converted",
    },
    {
      type: "kpi",
      label: "Pipeline value",
      value: "₹68,00,000",
      delta: { text: "+8% vs prior 15d", direction: "up", tone: "positive" },
      sublabel: "Won + open deals in the pipeline",
    },
    {
      type: "kpi",
      label: "Stale leads",
      value: "9",
      delta: { text: "3 fewer", direction: "down", tone: "positive" },
      sublabel: "No contact in 14+ days — needs follow-up",
    },
    {
      type: "line",
      title: "Leads trend",
      unit: "count",
      series: [
        {
          name: "Created",
          color: "primary",
          points: [
            { label: "29 Aug", value: 1 },
            { label: "30 Aug", value: 2 },
            { label: "31 Aug", value: 3 },
            { label: "1 Sep", value: 1 },
            { label: "2 Sep", value: 4 },
            { label: "3 Sep", value: 2 },
            { label: "4 Sep", value: 3 },
            { label: "5 Sep", value: 5 },
            { label: "6 Sep", value: 3 },
            { label: "7 Sep", value: 2 },
            { label: "8 Sep", value: 4 },
            { label: "9 Sep", value: 3 },
            { label: "10 Sep", value: 1 },
            { label: "11 Sep", value: 2 },
            { label: "12 Sep", value: 1 },
          ],
        },
        {
          name: "Won",
          color: "success",
          points: [
            { label: "29 Aug", value: 0 },
            { label: "30 Aug", value: 1 },
            { label: "31 Aug", value: 0 },
            { label: "1 Sep", value: 0 },
            { label: "2 Sep", value: 1 },
            { label: "3 Sep", value: 0 },
            { label: "4 Sep", value: 1 },
            { label: "5 Sep", value: 0 },
            { label: "6 Sep", value: 2 },
            { label: "7 Sep", value: 0 },
            { label: "8 Sep", value: 1 },
            { label: "9 Sep", value: 1 },
            { label: "10 Sep", value: 0 },
            { label: "11 Sep", value: 1 },
            { label: "12 Sep", value: 1 },
          ],
        },
      ],
    },
    {
      type: "bar",
      title: "Pipeline by stage",
      unit: "count",
      data: [
        { label: "New", value: 8, tone: "muted" },
        { label: "Contacted", value: 7, tone: "primary" },
        { label: "Qualified", value: 5, tone: "primary" },
        { label: "Proposal", value: 4, tone: "primary" },
        { label: "Negotiation", value: 4, tone: "warning" },
        { label: "Won", value: 9, tone: "success" },
      ],
    },
    {
      type: "donut",
      title: "Leads by source",
      totalLabel: "37 new leads",
      data: [
        { label: "Website", value: 14, color: "primary" },
        { label: "WhatsApp", value: 9, color: "success" },
        { label: "Referral", value: 7, color: "info" },
        { label: "Cold call", value: 4, color: "warning" },
        { label: "Campaign", value: 3, color: "muted" },
      ],
    },
    {
      type: "leaderboard",
      title: "Team leaderboard",
      unit: "count",
      rows: [
        { label: "Ananya Sharma", sublabel: "9 leads · 4 won", value: 9, tone: "success" },
        { label: "Rohan Mehta", sublabel: "8 leads · 3 won", value: 8, tone: "primary" },
        { label: "Priya Nair", sublabel: "7 leads · 1 won", value: 7, tone: "primary" },
        { label: "Vikram Rao", sublabel: "6 leads · 1 won", value: 6, tone: "warning" },
        { label: "Sneha Iyer", sublabel: "5 leads · 0 won", value: 5, tone: "muted" },
      ],
    },
    {
      type: "table",
      title: "Assignee breakdown",
      columns: [
        { key: "name", label: "Assignee" },
        { key: "count", label: "Leads" },
        { key: "won", label: "Won" },
        { key: "conversion", label: "Conversion" },
      ],
      rows: [
        { name: "Ananya Sharma", count: 9, won: 4, conversion: "44.4%" },
        { name: "Rohan Mehta", count: 8, won: 3, conversion: "37.5%" },
        { name: "Priya Nair", count: 7, won: 1, conversion: "14.3%" },
        { name: "Vikram Rao", count: 6, won: 1, conversion: "16.7%" },
        { name: "Sneha Iyer", count: 5, won: 0, conversion: "0%" },
        { name: "Unassigned", count: 2, won: 0, conversion: "0%" },
      ],
    },
  ],
}