/**
 * Local starter briefs, not hosted applications. Selecting one only prefills
 * the new-project form; a real build still requires the normal agent pipeline.
 * No provider credentials, payments, or automatic deployments are triggered.
 */
export interface AppStarter {
  id: string;
  name: string;
  description: string;
  audience: string;
  prompt: string;
  category?: string;
}

const expectations = `
ENGINEERING REQUIREMENTS
- Implement the main workflow end to end; every visible action must work or clearly report an unconfigured integration.
- Create working pages, server-side validation, accessible forms, loading/empty/error/success states, and responsive mobile navigation.
- Use Supabase Auth and owner-scoped Row-Level Security for private records; never put service-role keys in browser code.
- Generate migrations, environment example, setup instructions, seeded demo records explicitly labeled DEMO, and tests.
- Never simulate a successful payment, identity check, message delivery, external deployment, or database save.
- Use structured errors, idempotent external actions, and no automatic external side effects.
- Acceptance: authorized data persists after reload; unauthorized access is blocked; failed integrations produce actionable errors.
`.trim();

type ExtraStarterBrief = {
  id: string; name: string; category: string; audience: string; description: string;
  users: string; pages: string; tables: string; workflow: string;
  acceptance: string; integrations: string;
};

const EXTRA_STARTER_BRIEFS: readonly ExtraStarterBrief[] = [
  {
    "id": "inventory",
    "name": "Inventory & POS",
    "category": "Retail",
    "audience": "Shopkeepers",
    "description": "Manage stock, barcode lookup and daily sales.",
    "users": "owner, cashier and store manager",
    "pages": "product catalog, receive stock, POS cart, receipts, stock alerts, daily reports",
    "tables": "products, inventory_moves, locations, sales, sale_items, suppliers, audit_log",
    "workflow": "merchant registers items -> receives stock -> cashier scans or selects items -> completes an offline or cash sale -> stock adjusts and daily totals update",
    "acceptance": "simultaneous checkout cannot oversell; refunds reverse stock and sales accurately; reports match immutable transactions",
    "integrations": "Card-terminal and online gateway actions require an actual provider; cash sales are labeled cash."
  },
  {
    "id": "restaurant",
    "name": "Restaurant Orders",
    "category": "Hospitality",
    "audience": "Restaurants",
    "description": "Digital menu, takeaway orders and kitchen workflow.",
    "users": "manager, customer, cashier, kitchen staff",
    "pages": "menu, item customization, ordering, kitchen queue, order pickup, sales summary",
    "tables": "menu_items, item_options, orders, order_lines, kitchen_events, payments",
    "workflow": "manager publishes menu -> diner customizes meal -> order reaches kitchen queue -> cook marks preparing then ready -> pickup confirmation",
    "acceptance": "prices and availability validated server-side; each order has an immutable item snapshot; kitchen updates are role-protected",
    "integrations": "WhatsApp messages and online payments remain unconfigured until owner connects real services."
  },
  {
    "id": "school",
    "name": "School Management",
    "category": "Education",
    "audience": "Schools",
    "description": "Attendance, classes, assignments and fee records.",
    "users": "school admin, teacher, parent and learner",
    "pages": "student admissions, classes, attendance, marks, assignments, fee ledger, reports",
    "tables": "students, guardians, classrooms, enrollments, attendance, assessments, grades, fee_entries",
    "workflow": "administrator enrolls a learner -> teacher records attendance and marks -> parent sees authorized learner report -> fee ledger tracks unpaid and paid entries",
    "acceptance": "guardian cannot see unrelated pupils; marks have valid grade ranges; payment ledger never marks fees paid without verified proof",
    "integrations": "Online fee payment is manual until a genuine gateway with webhooks is connected."
  },
  {
    "id": "church",
    "name": "Church Ministry",
    "category": "Community",
    "audience": "Ministries",
    "description": "Members, events, care groups and prayer requests.",
    "users": "pastor, church administrator, group leader and member",
    "pages": "service events, attendance, small groups, member directory, prayer requests, announcements",
    "tables": "members, groups, memberships, events, attendance, prayer_requests, notices",
    "workflow": "administrator invites members -> assigns care groups -> members register for services and submit private prayer requests -> leaders update follow-up",
    "acceptance": "private requests visible only to authorized leaders; attendance reports aggregate correctly; no auto-messaging without permission",
    "integrations": "Donation processing and broadcast messages require opted-in verified integrations."
  },
  {
    "id": "tickets",
    "name": "Event Tickets",
    "category": "Events",
    "audience": "Organizers",
    "description": "Registration, tickets, QR check-in and capacity.",
    "users": "event organizer, attendee and gate staff",
    "pages": "event creation, ticket types, registration, ticket wallet, scanning check-in, attendance analytics",
    "tables": "events, ticket_types, registrations, tickets, checkins, audit_events",
    "workflow": "organizer opens event -> attendee reserves available ticket -> server issues unique QR token after authorization -> gate scans once -> seat counts update",
    "acceptance": "enforce maximum capacity and one-time redemption; cancelled tickets cannot enter; QR tokens are unguessable and protected",
    "integrations": "Paid ticket sales require a real payment processor and signed callbacks."
  },
  {
    "id": "housing",
    "name": "Property Rentals",
    "category": "Property",
    "audience": "Landlords",
    "description": "Listings, viewing bookings and tenant records.",
    "users": "property manager, prospective tenant and landlord",
    "pages": "properties, unit listing, available viewings, applications, leases, maintenance tickets",
    "tables": "properties, units, viewings, applications, lease_records, maintenance_requests",
    "workflow": "landlord publishes vacancy -> prospect requests viewing -> manager confirms slot -> applicant applies -> accepted lease tracks issues",
    "acceptance": "availability prevents overlapping viewing bookings; tenant records private; lease data has audit history",
    "integrations": "No automatic rent collection or legal validation without authorized providers and jurisdiction-specific review."
  },
  {
    "id": "invoicing",
    "name": "Invoice & Expenses",
    "category": "Finance",
    "audience": "Freelancers",
    "description": "Quotes, invoices, receipts and business expenses.",
    "users": "business owner, staff and customer",
    "pages": "customers, quotes, invoices, line items, expense ledger, reports",
    "tables": "customers, quotes, invoices, invoice_lines, expenses, receipts, audit_events",
    "workflow": "create quote -> convert to invoice -> send downloadable copy -> record verified cash/bank receipt -> reconcile balance",
    "acceptance": "money uses integer minor currency units; tax calculations transparent; receipt and edit history never silently erased",
    "integrations": "Bank synchronization and online charges remain disabled until verified connectors exist."
  },
  {
    "id": "courier",
    "name": "Courier & Deliveries",
    "category": "Logistics",
    "audience": "Dispatchers",
    "description": "Pickup requests, rider assignments and delivery tracking.",
    "users": "dispatcher, sender, rider and recipient",
    "pages": "booking, dispatch board, rider tasks, proof of delivery, order tracking",
    "tables": "shipments, stops, assignments, shipment_events, delivery_proofs, riders",
    "workflow": "sender requests delivery -> dispatcher quotes and assigns rider -> rider updates milestones -> recipient acknowledges successful handoff",
    "acceptance": "recipient-specific tracking access; GPS location requires consent; completed delivery has durable evidence and full status trail",
    "integrations": "Third-party maps, WhatsApp and live GPS must display setup-required until configured."
  },
  {
    "id": "printing",
    "name": "Academic Print Hub",
    "category": "Local Services",
    "audience": "Campus businesses",
    "description": "File orders, printing costs and pickup/delivery.",
    "users": "student customer, print technician and manager",
    "pages": "print order form, upload, pricing, order tracker, delivery schedule, admin queue",
    "tables": "print_orders, document_assets, print_options, price_rules, order_events, delivery_slots",
    "workflow": "customer uploads file -> selects black/white, color, pages, copies and finishing -> receives calculated quote -> technician verifies file and prints -> pickup or delivery",
    "acceptance": "enforce file-size/type limits and virus scanning; uploaded academic documents stay private; no order paid without verified receipt",
    "integrations": "Storage and payment require configured provider; never invent scan or document-delivery success."
  },
  {
    "id": "jobs",
    "name": "Job Board",
    "category": "Recruitment",
    "audience": "Employers",
    "description": "Vacancies, applications and applicant tracking.",
    "users": "recruiter, applicant and administrator",
    "pages": "job search, job details, applications, employer pipeline, notification settings",
    "tables": "employers, jobs, applicants, applications, interview_events",
    "workflow": "employer publishes role -> applicant completes profile -> applicant applies -> recruiter updates application stages -> applicant tracks own status",
    "acceptance": "duplicate applications prevented; protected CVs only visible to authorized employer; closing a role blocks applications",
    "integrations": "Email and AI CV matching require user consent and external configuration."
  },
  {
    "id": "grants",
    "name": "Scholarships & Grants",
    "category": "Research",
    "audience": "Applicants",
    "description": "Search funding, eligibility checks and deadlines.",
    "users": "applicant, funding administrator and reviewer",
    "pages": "opportunities, search filters, bookmarks, eligibility checklist, submissions, review pipeline",
    "tables": "funding_opportunities, eligibility_rules, bookmarks, applications, decision_events",
    "workflow": "staff publishes a verifiable opportunity with official link -> applicant filters -> saves -> checks requirements -> tracks manually submitted status",
    "acceptance": "show verified dates and sources; never fabricate awards or acceptance; privacy for eligibility evidence",
    "integrations": "Automated eligibility may be assisted but every opportunity needs verifiable primary-source data."
  },
  {
    "id": "ngo",
    "name": "NGO Programs & Donors",
    "category": "Community",
    "audience": "Nonprofits",
    "description": "Programs, volunteering, donations and impact reports.",
    "users": "program manager, volunteer, donor and administrator",
    "pages": "programs, volunteers, projects, donations ledger, outcomes, impact report",
    "tables": "programs, volunteers, assignments, donations, project_outcomes, donor_receipts",
    "workflow": "manager creates project -> volunteers apply -> team records verified activity -> donors review transparent project updates",
    "acceptance": "donation totals reconcile to provider-confirmed transactions; private donor data protected; no invented beneficiary statistics",
    "integrations": "Donations and email receipts depend on a real gateway and message service."
  },
  {
    "id": "clinic",
    "name": "Clinic Scheduling",
    "category": "Health",
    "audience": "Clinics",
    "description": "Patient appointments, staff shifts and follow-up.",
    "users": "administrator, clinician and patient",
    "pages": "service directory, appointment request, staff calendar, reminders and visit status",
    "tables": "clinics, providers, schedule_blocks, appointments, appointment_events, preferences",
    "workflow": "patient requests a consultation -> server checks provider availability -> staff confirms -> patient views own status and follow-up appointment",
    "acceptance": "patient records private; no diagnosis or medication recommendation; prevent double bookings and unauthorized access",
    "integrations": "Health data retention and privacy must be reviewed for local law before handling identifiable medical notes."
  },
  {
    "id": "hotel",
    "name": "Hotel Reservations",
    "category": "Hospitality",
    "audience": "Guesthouses",
    "description": "Room listings, bookings and front-desk operations.",
    "users": "property manager, front desk and guest",
    "pages": "rooms, rates, booking calendar, guest booking, check-in desk, housekeeping",
    "tables": "rooms, rate_plans, bookings, guest_profiles, checkin_events, housekeeping_tasks",
    "workflow": "manager sets room availability -> guest requests stay -> server checks inventory per date -> front desk confirms -> staff records checkout",
    "acceptance": "no overlapping confirmed room allocations; correct nights and taxes; no confirmed paid booking without receipt",
    "integrations": "Payments and third-party channel synchronization require authorized integrations."
  },
  {
    "id": "realestate",
    "name": "Real Estate Listings",
    "category": "Property",
    "audience": "Agents",
    "description": "Property listings, inquiries and viewing schedules.",
    "users": "agent, buyer, seller and brokerage admin",
    "pages": "search map, listing detail, saved homes, inquiries, viewing schedule, agent dashboard",
    "tables": "listings, listing_photos, agents, inquiries, favourites, viewing_slots",
    "workflow": "agent verifies and publishes listing -> buyer searches -> requests viewing -> assigned agent confirms and logs outcome",
    "acceptance": "private lead contact data protected; unavailable properties marked; duplicate/inaccurate listing flags",
    "integrations": "Map API access and outbound messages require configured providers."
  },
  {
    "id": "community",
    "name": "Membership Community",
    "category": "Community",
    "audience": "Clubs",
    "description": "Member directory, discussions and private resources.",
    "users": "community owner, moderator and member",
    "pages": "membership application, directory, groups, discussions, member resources",
    "tables": "communities, memberships, groups, posts, comments, resource_permissions",
    "workflow": "creator starts community -> member requests admission -> moderator approves -> member participates in authorized discussions",
    "acceptance": "private community content behind membership checks; moderation actions auditable; membership cancellations revoke access",
    "integrations": "Subscriptions and membership fees remain in setup-required state until verified billing is available."
  },
  {
    "id": "creator",
    "name": "Creator Content Studio",
    "category": "Media",
    "audience": "Creators",
    "description": "Content calendar, caption ideas and asset tracker.",
    "users": "creator, editor and collaborator",
    "pages": "drafts, calendar, post ideas, approval queue, assets, performance notes",
    "tables": "content_items, channels, scheduled_posts, approvals, assets, analytics_notes",
    "workflow": "creator writes draft -> editor reviews -> owner approves -> user records planned post date -> tracks performance after publishing",
    "acceptance": "posts are not represented as actually published without authorized social APIs; collaborator roles enforced",
    "integrations": "AI ideas may be generated, but auto-posting and analytics sync require opted-in provider connectors."
  },
  {
    "id": "service",
    "name": "Local Business Directory",
    "category": "Local Services",
    "audience": "Small businesses",
    "description": "Verified shop profiles, searchable services and leads.",
    "users": "directory manager, business owner and visitor",
    "pages": "business profiles, categories, local search, inquiry, claim listing, moderation",
    "tables": "businesses, categories, service_listings, inquiries, business_claims, moderation_events",
    "workflow": "owner submits business -> moderator reviews and verifies contact -> public searches -> visitor contacts business -> owner follows up",
    "acceptance": "never invent verification badges; reduce spam and protect personal contacts; published listings require business consent",
    "integrations": "Maps and notifications work only after the owner configures approved services."
  }
];

const EXTRA_STARTERS: readonly AppStarter[] = EXTRA_STARTER_BRIEFS.map((starter) => ({
  id: starter.id,
  name: starter.name,
  category: starter.category,
  audience: starter.audience,
  description: starter.description,
  prompt: [
    `Build a mobile-first, production-quality ${starter.name.toLowerCase()} application.`,
    `USERS: ${starter.users}.`,
    `PAGES: ${starter.pages}.`,
    `TABLES: ${starter.tables}.`,
    `WORKFLOW: ${starter.workflow}.`,
    `INTEGRATIONS: ${starter.integrations}.`,
    `ACCEPTANCE: ${starter.acceptance}.`,
    expectations,
  ].join("\n"),
}));

export const APP_STARTERS: readonly AppStarter[] = [
  {
    id: "commerce",
    category: "Commerce",
    name: "Online Store",
    audience: "Sellers",
    description: "Product catalog, cart and seller orders.",
    prompt: `Build a mobile-first online store for a small business.
USERS: shop owner and customer. Owner can edit products, stock, prices and order status. Customer can search, filter, add to cart and request checkout.
PAGES: storefront, product detail, cart/checkout, order status, seller dashboard.
TABLES: products, product_images, inventory, orders, order_items, customer_profiles.
WORKFLOW: seller publishes a product -> customer finds it -> cart calculates totals -> checkout creates a pending order -> owner updates fulfillment -> customer sees status.
INTEGRATIONS: keep payments in pending/setup-required mode until a real server-side processor and verified webhook are configured; no false paid badge.
ACCEPTANCE: totals recalculate correctly; stock cannot be negative; customer cannot see another customer's order.
${expectations}`,
  },
  {
    id: "appointments",
    category: "Local Services",
    name: "Booking System",
    audience: "Service teams",
    description: "Availability, appointments and confirmations.",
    prompt: `Build a responsive appointment scheduling system for a service provider.
USERS: administrator, staff member and customer with distinct permissions.
PAGES: services, available slots, booking, my appointments, staff calendar, admin settings.
TABLES: services, staff, availability_rules, blackout_dates, bookings, booking_events.
WORKFLOW: admin publishes service and staff hours -> customer selects available slot -> server confirms no conflict -> customer can view or cancel -> staff updates status.
INTEGRATIONS: email/SMS notifications must be opt-in and show 'not configured' until a real provider is connected.
ACCEPTANCE: two customers cannot reserve the same staff slot; all times show the selected timezone; invalid/expired slots fail safely.
${expectations}`,
  },
  {
    id: "education",
    category: "Education",
    name: "Learning Platform",
    audience: "Teachers",
    description: "Lessons, quizzes and learner progress.",
    prompt: `Build an accessible course and assessment platform.
USERS: educator, learner and administrator. Educator creates courses; learner enrolls, progresses through units, takes quizzes; admin manages content.
PAGES: course catalog, lesson reader, quiz, personal progress, educator course studio, admin review.
TABLES: courses, lessons, enrollments, questions, quiz_attempts, answers, completion_events.
WORKFLOW: educator publishes course -> learner enrolls -> unlocks lessons in sequence -> submits quiz once per attempt -> receives a real score -> progress persists.
ACCEPTANCE: scores derive from stored answers; one learner cannot read another learner's progress; incorrect answers show useful explanations; offline mode is never portrayed as synced.
${expectations}`,
  },
  {
    id: "crm",
    category: "Business",
    name: "Client CRM",
    audience: "Consultants",
    description: "Leads, tasks, pipeline and client follow-up.",
    prompt: `Build a practical client relationship and sales pipeline system for a small team.
USERS: business owner and team member. Owner can assign leads, team members see only authorized records.
PAGES: overview, leads, client profile, pipeline board, tasks/reminders, team settings.
TABLES: workspaces, team_members, contacts, opportunities, tasks, activity_logs.
WORKFLOW: add lead -> validate contact -> move deal through stages -> assign follow-up -> complete task -> record activity.
ACCEPTANCE: changes persist after refresh; lead stage totals are accurate; private contact details are permission protected; reminders are in-app only unless a provider is configured.
${expectations}`,
  },
  {
    id: "research",
    category: "Research",
    name: "Research Portal",
    audience: "Researchers",
    description: "Projects, sources and submission tracking.",
    prompt: `Build a research project and manuscript workflow portal.
USERS: researcher, reviewer and administrator with explicit permission boundaries.
PAGES: research dashboard, projects, source library, manuscript checklist, submission tracker, reviewer queue.
TABLES: research_projects, sources, source_annotations, manuscripts, submission_events, review_decisions.
WORKFLOW: researcher creates project -> records verifiable citations/DOIs -> builds manuscript checklist -> submits for reviewer approval -> tracks decision history.
INTEGRATIONS: external journal submission is manual until explicitly connected and authorized. Never invent DOIs, sources, acceptance notices, or indexing claims.
ACCEPTANCE: citation items link to actual source metadata; missing evidence is flagged; review decisions are auditable; private manuscripts stay private.
${expectations}`,
  },
  {
    id: "saas",
    category: "Technology",
    name: "SaaS Workspace",
    audience: "Founders",
    description: "Team workspaces, records and plan controls.",
    prompt: `Build a multi-tenant B2B SaaS workspace with a useful core record workflow.
USERS: workspace owner, administrator and member with distinct roles.
PAGES: onboarding, dashboard, record list, record editor, team, billing/settings.
TABLES: workspaces, memberships, records, activities, subscription_events.
WORKFLOW: sign up -> create workspace -> invite member -> create, search, edit and archive records -> review activity.
BILLING: show a demo plan clearly until server-side checkout, verified webhook and customer portal credentials are configured. Do not claim payments succeeded.
ACCEPTANCE: strict workspace isolation with RLS; roles constrain every read/write; search, edits and soft deletes persist; trial quotas are enforced server-side.
${expectations}`,
  },
  ...EXTRA_STARTERS,
] as const;
