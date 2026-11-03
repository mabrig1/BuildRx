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

export const APP_STARTERS: readonly AppStarter[] = [
  {
    id: "commerce",
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
] as const;
