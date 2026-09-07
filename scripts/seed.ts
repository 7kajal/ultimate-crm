import { eq } from "drizzle-orm"

import { auth } from "../src/lib/auth"
import { computeTotals } from "../src/lib/billing/gst"
import { db } from "../src/lib/db"
import {
  attendance,
  customers,
  departments,
  employees,
  invoiceItems,
  invoices,
  leadActivities,
  leads,
  leaveRequests,
  payments,
  settings,
  tasks,
  user,
  waContacts,
  waMessages,
  waTemplates,
} from "../src/lib/db/schema"
import { logger } from "../src/lib/logger"

const log = logger.child({ module: "seed" })

const USERS = [
  {
    name: "Aarav Sharma",
    email: "admin@company.com",
    password: "Admin@1234",
    role: "admin",
    designation: "Founder & CEO",
    phone: "+91 98200 00001",
  },
  {
    name: "Priya Nair",
    email: "manager@company.com",
    password: "Manager@1234",
    role: "manager",
    designation: "Sales Manager",
    phone: "+91 98200 00002",
  },
  {
    name: "Rohan Verma",
    email: "rohan@company.com",
    password: "Employee@1234",
    role: "employee",
    designation: "Sales Executive",
    phone: "+91 98200 00003",
  },
  {
    name: "Sneha Iyer",
    email: "sneha@company.com",
    password: "Employee@1234",
    role: "employee",
    designation: "Sales Executive",
    phone: "+91 98200 00004",
  },
  {
    name: "Vikram Singh",
    email: "vikram@company.com",
    password: "Manager@1234",
    role: "manager",
    designation: "Marketing Manager",
    phone: "+91 98200 00005",
  },
  {
    name: "Ananya Gupta",
    email: "ananya@company.com",
    password: "Employee@1234",
    role: "employee",
    designation: "Marketing Associate",
    phone: "+91 98200 00006",
  },
  {
    name: "Karthik Rao",
    email: "karthik@company.com",
    password: "Employee@1234",
    role: "employee",
    designation: "Sales Executive",
    phone: "+91 98200 00007",
  },
  {
    name: "Priyanka Mehta",
    email: "priyanka@company.com",
    password: "Employee@1234",
    role: "employee",
    designation: "Customer Success Associate",
    phone: "+91 98200 00008",
  },
  {
    name: "Dev Patel",
    email: "dev@company.com",
    password: "Employee@1234",
    role: "employee",
    designation: "Sales Intern",
    phone: "+91 98200 00009",
  },
]

async function seed() {
  for (const u of USERS) {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, u.email))
      .limit(1)

    if (existing.length > 0) {
      // Keep existing users once real/seeded data references them (invoices
      // and leads hold FKs to user). Credentials only change on full reset.
      log.info({ email: u.email }, "user exists — keeping")
      continue
    }

    const result = await auth.api.signUpEmail({
      body: {
        name: u.name,
        email: u.email,
        password: u.password,
        phone: u.phone,
        designation: u.designation,
      },
    })

    // Admin plugin defaults new users to the defaultRole; promote explicitly.
    await db.update(user).set({ role: u.role }).where(eq(user.id, result.user.id))
    log.info({ email: u.email, role: u.role }, "created user")
  }

  await db
    .insert(settings)
    .values({
      id: 1,
      companyName: "Acme Ventures Pvt Ltd",
      invoicePrefix: "INV",
      defaultGstRate: 18,
    })
    .onConflictDoNothing()

  await seedLeads()
  await seedHr()
  await seedBilling()
  await seedWhatsApp()
  log.info("seed complete")
  process.exit(0)
}

async function seedWhatsApp() {
  const existing = await db.select({ id: waContacts.id }).from(waContacts).limit(1)
  if (existing.length > 0) {
    log.info("whatsapp already seeded — skipping")
    return
  }

  const allUsers = await db.select({ id: user.id, email: user.email }).from(user)
  const rohan = allUsers.find((u) => u.email === "rohan@company.com")!

  const leadRows = await db
    .select({ id: leads.id, name: leads.name, phone: leads.phone })
    .from(leads)
  const leadByPhone = new Map(
    leadRows.filter((l) => l.phone).map((l) => [l.phone!.replace(/\D/g, "").slice(-10), l])
  )

  const convos = [
    {
      phone: "919820166774",
      name: "Meera Joshi",
      leadPhone: "9920166774",
      messages: [
        { dir: "in" as const, body: "Hi! Saw your proposal — is the 10% discount still available?", minsAgo: 90 },
        { dir: "out" as const, body: "Hello Meera! Yes, the annual-contract discount is still on the table. Shall I share the revised quote?", minsAgo: 80 },
        { dir: "in" as const, body: "Yes please. Also can we do site visit next week?", minsAgo: 12 },
      ],
    },
    {
      phone: "919028099887",
      name: "Sanjay Patil",
      leadPhone: "9028099887",
      messages: [
        { dir: "in" as const, body: "Invoice received, processing payment this week.", minsAgo: 300 },
        { dir: "out" as const, body: "Thank you Sanjay! Let us know once done — will share the receipt.", minsAgo: 290 },
      ],
    },
    {
      phone: "919848011223",
      name: "Kavya Reddy",
      leadPhone: "9848011223",
      messages: [
        { dir: "in" as const, body: "What are your bulk rates for 500+ units?", minsAgo: 1500 },
      ],
    },
  ] as const

  for (const convo of convos) {
    const lead = leadByPhone.get(convo.leadPhone)
    const lastAt = new Date(Date.now() - convo.messages[convo.messages.length - 1].minsAgo * 60000)

    const [contact] = await db
      .insert(waContacts)
      .values({
        waPhone: convo.phone,
        name: convo.name,
        pushName: convo.name,
        leadId: lead?.id ?? null,
        lastMessageAt: lastAt,
        assignedTo: rohan.id,
      })
      .returning({ id: waContacts.id })

    await db.insert(waMessages).values(
      convo.messages.map((m) => ({
        waMessageId: `seed_${convo.phone}_${m.minsAgo}`,
        contactId: contact.id,
        direction: m.dir,
        type: "text" as const,
        body: m.body,
        status: m.dir === "in" ? ("received" as const) : ("read" as const),
        sentBy: m.dir === "out" ? rohan.id : null,
        timestamp: new Date(Date.now() - m.minsAgo * 60000),
      }))
    )
  }

  // Templates in every state (as if synced from Meta).
  await db.insert(waTemplates).values([
    {
      metaTemplateId: "tpl_seed_1",
      name: "followup_intro",
      category: "UTILITY",
      language: "en",
      status: "APPROVED",
      lastSyncedAt: new Date(),
      components: [{ type: "BODY", text: "Hi {{1}}, following up on your enquiry — shall we schedule a quick call?" }],
    },
    {
      metaTemplateId: "tpl_seed_2",
      name: "diwali_offer",
      category: "MARKETING",
      language: "en",
      status: "APPROVED",
      lastSyncedAt: new Date(),
      components: [{ type: "BODY", text: " festive offer! Flat 15% off until Diwali. Reply STOP to opt out." }],
    },
    {
      metaTemplateId: "tpl_seed_3",
      name: "payment_reminder",
      category: "UTILITY",
      language: "en",
      status: "PENDING",
      lastSyncedAt: new Date(),
      components: [{ type: "BODY", text: "Reminder: invoice {{1}} of {{2}} is due on {{3}}." }],
    },
  ])

  log.info("whatsapp data created")
}

async function seedBilling() {
  const existing = await db.select({ id: invoices.id }).from(invoices).limit(1)
  if (existing.length > 0) {
    log.info("billing already seeded — skipping")
    return
  }

  const allUsers = await db.select({ id: user.id, email: user.email }).from(user)
  const admin = allUsers.find((u) => u.email === "admin@company.com")!

  // Two customers converted from seeded leads.
  const customerRows = await db
    .insert(customers)
    .values([
      {
        name: "Meera Joshi",
        company: "Joshi Interiors",
        email: "meera@joshiint.in",
        phone: "+91 99201 66774",
        gstin: "27ABCDE1234F1Z5",
        state: "Maharashtra",
        createdBy: admin.id,
      },
      {
        name: "Sanjay Patil",
        company: "Patil Agro",
        email: "sanjay@patilagro.com",
        phone: "+91 90280 99887",
        state: "Karnataka",
        createdBy: admin.id,
      },
    ])
    .returning({ id: customers.id, name: customers.name })

  let counter = 0
  const year = new Date().getFullYear()

  const mkInvoice = async (
    customerId: string,
    customerName: string,
    status: "draft" | "sent" | "paid" | "overdue",
    items: { description: string; qty: number; rate: number; gstRate: number }[],
    issuedDaysAgo: number,
    dueInDays: number
  ) => {
    counter += 1
    const number = `INV-${year}-${String(counter).padStart(4, "0")}`
    const totals = computeTotals(
      items.map((it) => ({
        description: it.description,
        quantity: it.qty,
        unitPrice: it.rate * 100,
        gstRate: it.gstRate,
      })),
      { discount: 0, placeOfSupply: "27", supplierState: "27" }
    )
    const issue = new Date()
    issue.setDate(issue.getDate() - issuedDaysAgo)
    const due = new Date()
    due.setDate(due.getDate() + dueInDays)

    const [invoice] = await db
      .insert(invoices)
      .values({
        number,
        publicToken: crypto.randomUUID().replace(/-/g, ""),
        customerId,
        issueDate: issue.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        status,
        placeOfSupply: "27",
        isInterState: false,
        subtotal: totals.subtotal,
        discount: 0,
        taxTotal: totals.taxTotal,
        total: totals.total,
        sentAt: status === "draft" ? null : issue,
        createdBy: admin.id,
      })
      .returning({ id: invoices.id })

    await db.insert(invoiceItems).values(
      totals.items.map((it, i) => ({
        invoiceId: invoice.id,
        position: i,
        description: it.description,
        quantity: String(it.quantity),
        unitPrice: it.unitPrice,
        gstRate: it.gstRate,
        amount: it.amount,
      }))
    )

    if (status === "paid") {
      await db.insert(payments).values({
        invoiceId: invoice.id,
        razorpayPaymentId: `pay_seed_${counter}`,
        amount: totals.total,
        method: "upi",
        status: "captured",
        paidAt: new Date(),
      })
      await db.update(invoices).set({ amountPaid: totals.total }).where(eq(invoices.id, invoice.id))
    }

    log.info({ number, customer: customerName, status }, "invoice seeded")
  }

  const [meera, sanjay] = customerRows

  await mkInvoice(meera.id, "Meera Joshi", "paid", [
    { description: "Interior design consultancy — April", qty: 1, rate: 85000, gstRate: 18 },
  ], 40, -10)
  await mkInvoice(meera.id, "Meera Joshi", "overdue", [
    { description: "Modular kitchen execution", qty: 1, rate: 145000, gstRate: 18 },
    { description: "Site supervision (per visit)", qty: 4, rate: 2500, gstRate: 18 },
  ], 35, -5)
  await mkInvoice(sanjay.id, "Sanjay Patil", "sent", [
    { description: "Agri-SaaS annual subscription", qty: 1, rate: 60000, gstRate: 18 },
  ], 3, 12)
  await mkInvoice(sanjay.id, "Sanjay Patil", "draft", [
    { description: "Hardware supply (50 units)", qty: 50, rate: 1200, gstRate: 12 },
  ], 0, 15)

  await db
    .update(settings)
    .set({ invoiceCounter: counter })
    .where(eq(settings.id, 1))

  log.info("billing data created")
}

async function seedHr() {
  // Departments: upsert (no early return — new employees may need them).
  await db
    .insert(departments)
    .values([
      { name: "Sales", description: "Pipeline and revenue" },
      { name: "Marketing", description: "Demand generation" },
      { name: "Support", description: "Customer success" },
    ])
    .onConflictDoNothing()

  const deptRows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
  const deptByName = new Map(deptRows.map((d) => [d.name, d.id]))

  const allUsers = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
  const byEmail = new Map(allUsers.map((u) => [u.email, u]))
  const admin = byEmail.get("admin@company.com")!
  const manager = byEmail.get("manager@company.com")!
  const vikram = byEmail.get("vikram@company.com")

  const profiles = [
    { email: "admin@company.com", code: "EMP-001", dept: "Sales", manager: null, type: "full_time" as const },
    { email: "manager@company.com", code: "EMP-002", dept: "Sales", manager: admin.id, type: "full_time" as const },
    { email: "rohan@company.com", code: "EMP-003", dept: "Sales", manager: manager.id, type: "full_time" as const },
    { email: "sneha@company.com", code: "EMP-004", dept: "Support", manager: manager.id, type: "full_time" as const },
    { email: "vikram@company.com", code: "EMP-005", dept: "Marketing", manager: admin.id, type: "full_time" as const },
    { email: "ananya@company.com", code: "EMP-006", dept: "Marketing", manager: vikram?.id ?? admin.id, type: "full_time" as const },
    { email: "karthik@company.com", code: "EMP-007", dept: "Sales", manager: manager.id, type: "full_time" as const },
    { email: "priyanka@company.com", code: "EMP-008", dept: "Support", manager: manager.id, type: "part_time" as const },
    { email: "dev@company.com", code: "EMP-009", dept: "Sales", manager: manager.id, type: "intern" as const },
  ]

  let createdProfiles = 0
  for (const p of profiles) {
    const u = byEmail.get(p.email)
    if (!u) continue // user not created (e.g. partial seed) — skip safely
    const inserted = await db
      .insert(employees)
      .values({
        userId: u.id,
        employeeCode: p.code,
        departmentId: deptByName.get(p.dept) ?? null,
        managerId: p.manager,
        employmentType: p.type,
        joinedAt: "2025-04-01",
        leaveBalance: 24,
      })
      .onConflictDoNothing()
      .returning({ userId: employees.userId })
    createdProfiles += inserted.length
  }
  if (createdProfiles > 0) log.info({ count: createdProfiles }, "employee profiles created")

  // Attendance + leaves: one-time sample data (skip if already present).
  const attExists = await db.select({ id: attendance.id }).from(attendance).limit(1)
  if (attExists.length > 0) return

  const attendanceRows: {
    userId: string
    day: string
    status: "present" | "wfh" | "leave" | "absent"
  }[] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() - 13)
  while (cursor <= new Date()) {
    const dow = cursor.getDay()
    if (dow !== 0) {
      for (const p of profiles) {
        const u = byEmail.get(p.email)
        if (!u) continue
        const seed = (cursor.getDate() + u.id.length) % 11
        const status =
          seed === 3 ? "wfh" : seed === 7 ? "leave" : seed === 9 ? "absent" : "present"
        attendanceRows.push({
          userId: u.id,
          day: cursor.toISOString().slice(0, 10),
          status,
        })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  await db.insert(attendance).values(attendanceRows).onConflictDoNothing()

  const rohan = byEmail.get("rohan@company.com")!
  const sneha = byEmail.get("sneha@company.com")!
  await db.insert(leaveRequests).values([
    {
      userId: rohan.id,
      type: "casual",
      status: "pending",
      startDate: offsetDate(5),
      endDate: offsetDate(6),
      days: 2,
      reason: "Family function out of town",
    },
    {
      userId: sneha.id,
      type: "sick",
      status: "approved",
      startDate: offsetDate(-4),
      endDate: offsetDate(-4),
      days: 1,
      reason: "Fever",
      reviewedBy: manager.id,
      reviewedAt: new Date(),
    },
    {
      userId: rohan.id,
      type: "casual",
      status: "rejected",
      startDate: offsetDate(-10),
      endDate: offsetDate(-9),
      days: 2,
      reason: "Personal",
      reviewedBy: manager.id,
      reviewedAt: new Date(),
    },
  ])

  log.info("hr data created")
}

function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const SAMPLE_LEADS = [
  { name: "Kavya Reddy", company: "Sunrise Textiles", email: "kavya@sunrisetex.in", phone: "+91 98480 11223", source: "website", stage: "qualified", value: 250000, assignee: "manager@company.com", tags: ["bulk-order"] },
  { name: "Arjun Mehta", company: "Mehta & Sons", email: "arjun@mehtasons.com", phone: "+91 98201 44556", source: "referral", stage: "proposal", value: 480000, assignee: "rohan@company.com", tags: ["priority"] },
  { name: "Divya Krishnan", company: "Chennai Foods", email: "divya@chennaifoods.in", phone: "+91 98847 77889", source: "whatsapp", stage: "new", value: 120000, assignee: null, tags: [] },
  { name: "Imran Khan", company: "Blast Furnace Supplies", email: "imran@bfsupplies.com", phone: "+91 99870 33221", source: "cold_call", stage: "contacted", value: 900000, assignee: "sneha@company.com", tags: ["enterprise"] },
  { name: "Meera Joshi", company: "Joshi Interiors", email: "meera@joshiint.in", phone: "+91 99201 66774", source: "campaign", stage: "negotiation", value: 320000, assignee: "rohan@company.com", tags: ["repeat"] },
  { name: "Sanjay Patil", company: "Pati Agro", email: "sanjay@patilagro.com", phone: "+91 90280 99887", source: "website", stage: "won", value: 150000, assignee: "sneha@company.com", tags: [] },
  { name: "Farah Ali", company: "Ali Traders", email: "farah@alitraders.in", phone: "+91 97690 22110", source: "other", stage: "lost", value: 60000, assignee: "rohan@company.com", tags: [] },
] as const

async function seedLeads() {
  const existing = await db.select({ id: leads.id }).from(leads).limit(1)
  if (existing.length > 0) {
    log.info("leads already seeded — skipping")
    return
  }

  const allUsers = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
  const byEmail = new Map(allUsers.map((u) => [u.email, u]))
  const admin = byEmail.get("admin@company.com")!

  for (const l of SAMPLE_LEADS) {
    const assignee = l.assignee ? byEmail.get(l.assignee) : undefined
    const [lead] = await db
      .insert(leads)
      .values({
        name: l.name,
        company: l.company,
        email: l.email,
        phone: l.phone,
        source: l.source,
        stage: l.stage,
        value: l.value * 100,
        tags: [...l.tags],
        assignedTo: assignee?.id ?? null,
        createdBy: admin.id,
        aiScore: Math.floor(Math.random() * 60) + 35,
      })
      .returning({ id: leads.id })

    await db.insert(leadActivities).values([
      {
        leadId: lead.id,
        userId: admin.id,
        type: "system",
        body: "Lead created",
      },
      ...(assignee
        ? [
            {
              leadId: lead.id,
              userId: admin.id,
              type: "assignment" as const,
              body: `Assigned to ${l.assignee}`,
            },
          ]
        : []),
    ])

    if (l.stage !== "new") {
      await db.insert(leadActivities).values({
        leadId: lead.id,
        userId: assignee?.id ?? admin.id,
        type: "call",
        body: "Intro call done — shared catalogue and pricing.",
      })
    }

    if (["proposal", "negotiation", "won"].includes(l.stage)) {
      await db.insert(tasks).values({
        title: `Send revised proposal to ${l.name}`,
        priority: l.stage === "won" ? "low" : "high",
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        assigneeId: assignee?.id ?? admin.id,
        leadId: lead.id,
        createdBy: admin.id,
      })
    }
  }

  log.info({ count: SAMPLE_LEADS.length }, "sample leads created")
}

seed().catch((err) => {
  log.error({ err }, "seed failed")
  process.exit(1)
})
