# Z Call Agent — Production-Ready SaaS Dashboard + Backend Build Prompt

## ROLE

You are a senior SaaS product architect, UI/UX designer, full-stack engineer, backend engineer, security engineer, and DevOps engineer.

Build a **production-ready multi-tenant SaaS Dashboard + Backend** for a product named:

# Z Call Agent

Z Call Agent is a B2B SaaS platform for deploying and managing realtime AI voice agents. The realtime voice engine will use **LiveKit**. The dashboard/backend is the **control plane**: it manages tenants, users, voice agents, configurations, phone numbers, integrations, calls, analytics, usage, plans, limits, billing-ready structures, audit logs, and platform administration.

The product must be designed from day one as a **true multi-tenant SaaS**, not as a single-client application.

---

# 1. CORE PRODUCT PRINCIPLES

Build the product around these principles:

1. Every business/customer is an isolated tenant.
2. A tenant must never be able to access another tenant's data.
3. Platform admins can manage all tenants.
4. Client users can access only their own tenant.
5. Every tenant can have multiple voice agents.
6. Every voice agent can have its own configuration, tools, knowledge, voice, business rules, and integrations.
7. LiveKit is the realtime execution layer, not the source of truth for SaaS business data.
8. SaaS backend is the control plane.
9. Never expose LiveKit secrets, API secrets, provider secrets, or privileged backend credentials to the browser.
10. All important limits must be enforced server-side.
11. The UI must be production-quality, responsive, accessible, fast, and consistent.
12. Do not build fake functionality where a real backend implementation is expected.
13. Use clean architecture so the LiveKit engine can be integrated without rewriting the dashboard.
14. Design APIs and database models for future scale.
15. Use strict validation, authorization, logging, error handling, and auditability.

---

# 2. PRODUCT NAME / BRAND

Product name:

**Z Call Agent**

Brand direction:

- Modern B2B AI SaaS
- Premium
- Technical but approachable
- Clean
- Minimal
- Trustworthy
- Voice/AI infrastructure feel
- Avoid generic "AI robot" visual clichés
- Z should be part of the brand identity but not overly decorative
- Use a professional SaaS visual language
- Support dark and light themes if the existing application architecture allows it
- Use consistent design tokens

Do not randomly rename the product.

---

# 3. APPLICATION STRUCTURE

Build a role-aware SaaS application with:

## Public

- Landing page integration point
- Login
- Forgot password
- Reset password
- Invite acceptance
- Terms
- Privacy
- Contact/support entry point

## Platform/Admin Area

For Z Call Agent internal team:

- Admin Overview
- Clients/Tenants
- Client Details
- Client Onboarding
- Users
- Voice Agents
- Live Calls
- Call History
- Usage
- Plans
- Subscriptions/Billing-ready structures
- Integrations
- System Health
- Audit Logs
- Support
- Platform Settings

## Client Area

For business customers:

- Overview
- Voice Agents
- Calls
- Appointments
- Customers/Contacts
- Phone Numbers
- Knowledge Base
- Integrations
- Analytics
- Usage
- Team
- Settings

Use RBAC to determine what each user can see and perform.

---

# 4. USER ROLES

Implement platform-level roles:

- SUPER_ADMIN
- ADMIN
- SUPPORT

Implement tenant-level roles:

- OWNER
- ADMIN
- MANAGER
- STAFF
- VIEWER

Permissions must be explicit.

Example:

OWNER:
- Full tenant access
- Billing/subscription access
- Team management
- Agent management
- Integration management
- Settings

ADMIN:
- Most tenant operations
- Team management
- Agent management
- Integrations

MANAGER:
- Agents
- Calls
- Analytics
- Appointments
- Customers

STAFF:
- Calls
- Appointments
- Customers
- Limited agent visibility

VIEWER:
- Read-only analytics/calls/basic information

Platform users must not be treated as tenant users.

---

# 5. MULTI-TENANT ARCHITECTURE

This is a critical requirement.

Use a tenant-first data model.

Core entity:

`Tenant`

Every tenant-owned resource must have a `tenantId`.

Examples:

- users
- agents
- agent_versions
- calls
- call_events
- transcripts
- recordings metadata
- appointments
- customers
- phone_numbers
- knowledge_bases
- knowledge_documents
- integrations
- usage_records
- analytics
- webhooks
- audit_logs
- notification settings

Never rely on frontend-provided tenant IDs for authorization.

The backend must derive the authenticated user's tenant context from the authenticated identity/session.

Every tenant-scoped request must perform:

1. Authentication
2. Role validation
3. Tenant resolution
4. Resource ownership validation
5. Permission validation
6. Business-rule validation
7. Operation

Prevent IDOR and cross-tenant access.

Do not use insecure patterns such as:

`GET /api/calls/:id`

without verifying tenant ownership.

---

# 6. DATABASE DESIGN

Create a clean relational database schema.

Use PostgreSQL unless the existing project already has a production-ready database choice.

Suggested core tables/entities:

## Platform

- platform_users
- platform_roles
- platform_settings

## Tenancy

- tenants
- tenant_settings
- tenant_domains (future-ready)
- tenant_members

## Authentication

- users
- sessions
- invitations
- password_reset_tokens
- login_events

## Plans / Billing

- plans
- plan_features
- tenant_subscriptions
- usage_limits
- invoices (billing-ready)
- payment_events (billing-ready)

## Voice Agents

- agents
- agent_versions
- agent_prompts
- agent_voices
- agent_models
- agent_tools
- agent_business_hours
- agent_transfer_rules
- agent_fallback_rules

## Calls

- calls
- call_participants
- call_events
- call_transcripts
- call_summaries
- call_recordings
- call_outcomes
- call_tags

## Customers

- customers
- customer_notes
- customer_interactions

## Appointments

- appointments
- appointment_events
- availability_rules

## Phone

- phone_numbers
- phone_number_assignments
- phone_number_events

## Knowledge

- knowledge_bases
- knowledge_documents
- knowledge_chunks
- knowledge_sync_jobs

## Integrations

- integrations
- integration_credentials
- integration_events
- webhooks
- webhook_deliveries

## Usage

- usage_records
- usage_daily
- usage_monthly
- concurrent_session_events

## Audit

- audit_logs

Use appropriate:

- primary keys
- foreign keys
- unique constraints
- indexes
- composite indexes
- timestamps
- soft deletion where appropriate
- status enums
- optimistic locking/versioning where useful

Never store raw provider secrets in plaintext.

---

# 7. TENANT CREATION / ONBOARDING

The Z Call Agent internal team must be able to create and configure a client.

Create a production-quality onboarding wizard.

## Step 1 — Business Details

Fields:

- Business Name
- Legal/Display Name
- Industry
- Website
- Business Email
- Business Phone
- Country
- Timezone
- Address
- City
- State
- Postal Code
- Business Description

## Step 2 — Primary Contact

- Name
- Email
- Phone
- Role

## Step 3 — Plan

- Plan
- Billing cycle
- Max voice agents
- Monthly voice minutes
- Max users
- Max phone numbers
- Max concurrent calls
- Knowledge storage limit
- Integration limit

## Step 4 — Create Initial Admin

- Name
- Email
- Role
- Send invitation

## Step 5 — Create Voice Agent

- Agent name
- Agent type
- Purpose
- Language
- Voice
- Greeting
- Personality
- Tone
- System instructions

## Step 6 — Knowledge

- Upload documents
- Add website
- Add FAQs
- Add business information

## Step 7 — Tools

Enable:

- Check availability
- Book appointment
- Reschedule
- Cancel appointment
- Create customer
- Update customer
- Send SMS
- Send email
- Transfer call
- Create lead
- Webhook

## Step 8 — Integrations

Future-ready connectors:

- Google Calendar
- Microsoft Calendar
- CRM
- Webhooks
- Email
- SMS
- WhatsApp

## Step 9 — Phone Number

- Add/import phone number
- Assign agent
- Configure routing

## Step 10 — Test

Provide a test checklist:

- Agent configuration valid
- Voice provider configured
- LiveKit configuration valid
- Tools available
- Integrations healthy
- Phone routing valid
- Limits valid

## Step 11 — Deploy

Agent status lifecycle:

- DRAFT
- CONFIGURING
- TESTING
- ACTIVE
- PAUSED
- SUSPENDED
- ARCHIVED

Do not activate an agent when required configuration is invalid.

---

# 8. ADMIN DASHBOARD

Create a professional internal dashboard.

## Sidebar

- Overview
- Clients
- Voice Agents
- Calls
- Usage
- Plans
- Billing
- Integrations
- System Health
- Audit Logs
- Support
- Settings

## Admin Overview

Show:

- Total clients
- Active clients
- Trial clients
- Suspended clients
- Active agents
- Calls today
- Calls this month
- Voice minutes today
- Voice minutes this month
- Appointment bookings
- Failed calls
- Transfer rate
- Agent error rate
- System health

Include charts and useful tables.

Do not fill production analytics with hardcoded fake values. If no data exists, show a meaningful empty state.

---

# 9. CLIENT MANAGEMENT

Admin Clients page:

Table columns:

- Business
- Industry
- Plan
- Status
- Agents
- Calls
- Minutes
- Created
- Last Activity
- Health
- Actions

Filters:

- Status
- Plan
- Industry
- Date
- Health

Search:

- Business name
- Email
- Phone
- Tenant ID

Actions:

- View
- Edit
- Suspend
- Reactivate
- Archive
- Impersonation/support access only if explicitly implemented with secure audit logging

---

# 10. CLIENT DETAIL PAGE

Admin opens a client:

Header:

- Business name
- Status
- Plan
- Tenant ID
- Created date
- Last activity

Tabs:

- Overview
- Business
- Users
- Agents
- Calls
- Appointments
- Customers
- Phone Numbers
- Knowledge
- Integrations
- Usage
- Limits
- Billing
- Audit

Provide useful health indicators.

Example:

- Agent healthy
- LiveKit connection healthy
- Calendar connected
- Phone number active
- Knowledge indexing complete
- Usage within limit

---

# 11. CLIENT DASHBOARD

The client should have a separate experience from platform admins.

Sidebar:

- Overview
- Voice Agents
- Calls
- Appointments
- Customers
- Phone Numbers
- Knowledge Base
- Integrations
- Analytics
- Usage
- Team
- Settings

Do not expose platform administration features to client users.

---

# 12. CLIENT OVERVIEW

Display:

- Calls today
- Calls this week
- Voice minutes
- Appointments
- Leads
- Transfers
- Average call duration
- Agent resolution rate

Recent calls table:

- Caller
- Agent
- Date/time
- Duration
- Intent
- Outcome
- Status

Agent status cards:

- Online
- Offline
- Paused
- Error

---

# 13. VOICE AGENTS PAGE

List all agents.

Each card/table row:

- Agent name
- Type
- Status
- Assigned number
- Language
- Voice
- Calls today
- Minutes
- Resolution rate
- Last active
- Actions

Actions:

- View
- Configure
- Duplicate
- Test
- Activate
- Pause
- Archive

---

# 14. VOICE AGENT CONFIGURATION

Create a comprehensive configuration interface.

Sections:

## General

- Agent name
- Description
- Status
- Environment

## Identity

- Role
- Company
- Personality
- Tone
- Communication style
- Greeting
- Closing message

## Voice

- Provider
- Voice
- Language
- Accent
- Speaking speed
- Optional voice settings

## AI

- Model
- Temperature
- Max response length
- System instructions

Do not expose secret provider credentials.

## Conversation

- Interruptions
- Silence timeout
- Greeting timeout
- Maximum conversation duration
- Fallback behavior
- Confirmation behavior

## Business Hours

Monday-Sunday configuration.

Support:

- open time
- close time
- closed day
- holidays

After-hours actions:

- take message
- schedule callback
- transfer
- voicemail
- custom response

## Call Transfer

- Primary transfer number
- Fallback number
- Transfer timeout
- Transfer conditions
- Human handoff message

## Tools

Enable/configure tools.

## Knowledge

Attach knowledge bases.

## Integrations

Attach tenant integrations.

## Advanced

Only expose advanced settings to authorized roles.

---

# 15. AGENT VERSIONING

Do not directly overwrite production configuration without tracking changes.

Implement:

- Draft version
- Published version
- Version number
- Created by
- Created at
- Change summary
- Publish action
- Rollback

Example:

`v1 → v2 → v3`

Production agent should run a known published configuration.

This makes debugging and rollback possible.

---

# 16. TEST AGENT EXPERIENCE

Create a test interface.

User can:

- Start test session
- Speak to agent
- View realtime status
- View tool calls
- View transcript
- View latency indicators
- End session

Clearly mark test vs production.

Never accidentally use production phone routing for a test.

---

# 17. CALLS

Client Calls page:

Filters:

- Date range
- Agent
- Status
- Outcome
- Intent
- Duration
- Transferred
- Appointment booked

Call details:

- Caller
- Agent
- Start time
- End time
- Duration
- Status
- Intent
- Outcome
- Transfer
- Appointment
- AI summary
- Transcript
- Recording metadata
- Tool calls
- Errors
- Events

If recording is not available, do not show a broken player. Show a proper unavailable state.

---

# 18. CALL TRANSCRIPT

Design transcript UI with:

- Speaker
- Timestamp
- Message
- Tool invocation
- Tool result
- System event

Example:

CUSTOMER:
"I want an appointment tomorrow."

AGENT:
"Sure. Let me check availability."

TOOL:
`check_availability`

RESULT:
`10:30 AM, 2:00 PM available`

AGENT:
"Tomorrow we have 10:30 AM and 2 PM."

---

# 19. APPOINTMENTS

Client can see:

- Upcoming
- Completed
- Cancelled
- Rescheduled

Fields:

- Customer
- Agent
- Date
- Time
- Service
- Status
- Source

Support calendar integration architecture.

---

# 20. CUSTOMERS / CONTACTS

Customer list:

- Name
- Phone
- Email
- Last call
- Total calls
- Appointments
- Tags

Customer profile:

- Basic details
- Call history
- Appointments
- Notes
- Interactions

Tenant isolation is mandatory.

---

# 21. PHONE NUMBERS

Page:

- Number
- Provider
- Assigned agent
- Status
- Incoming calls
- Outgoing calls
- Created

Actions:

- Assign
- Reassign
- Configure
- Release

Phone numbers must belong to the correct tenant.

---

# 22. KNOWLEDGE BASE

Build a production-ready knowledge management UI.

Support:

- PDF
- DOCX
- TXT
- Markdown
- Website URL
- FAQ/manual entry

Document statuses:

- UPLOADING
- PROCESSING
- INDEXING
- READY
- FAILED
- ARCHIVED

Show:

- File name
- Type
- Size
- Status
- Created by
- Updated
- Last indexed

Future-ready for RAG/vector search.

---

# 23. INTEGRATIONS

Create an integrations marketplace-style UI.

Categories:

- Calendar
- CRM
- Communication
- Webhooks
- Productivity

Each integration:

- Connected / Not connected
- Last sync
- Health
- Configure
- Disconnect

Credentials must be encrypted at rest.

Do not expose credentials through API responses.

---

# 24. ANALYTICS

Client analytics:

- Calls
- Answer rate
- Transfer rate
- Resolution rate
- Average duration
- Voice minutes
- Appointment conversion
- Lead conversion
- Failed calls
- Top intents
- Peak hours
- Agent performance

Use meaningful date filters:

- Today
- 7 days
- 30 days
- 90 days
- Custom

Do not generate misleading metrics when sample size is insufficient.

---

# 25. USAGE

Usage dashboard:

## Voice

- Minutes used
- Minutes remaining
- Calls
- Concurrent calls

## Agents

- Active agents
- Agent limit

## Users

- Team members
- User limit

## Phone Numbers

- Numbers used
- Number limit

## Knowledge

- Storage used
- Storage limit

Display progress clearly.

Warn before limits:

- 70%
- 85%
- 95%
- 100%

But all actual enforcement must happen in backend services.

---

# 26. PLAN AND LIMIT ENGINE

Create a centralized entitlement system.

Example plan:

FREE / STARTER / PRO / BUSINESS / CUSTOM

Features may include:

- max_agents
- monthly_minutes
- max_users
- max_phone_numbers
- max_concurrent_calls
- knowledge_storage
- integrations
- recording
- analytics
- API access
- webhooks

Do not hardcode plan logic in multiple frontend pages.

Use one entitlement/usage service.

Example conceptual API:

`checkEntitlement(tenantId, feature)`

and:

`getUsage(tenantId)`

---

# 27. BILLING-READY ARCHITECTURE

Even if payment integration is not implemented immediately, design for it.

Support:

- plan
- subscription
- billing cycle
- renewal date
- status
- trial
- cancellation
- invoices
- payment events

Do not fake successful payments.

Create clean interfaces so Stripe or another payment provider can be integrated later.

---

# 28. LIVEKIT INTEGRATION BOUNDARY

Treat LiveKit as the realtime voice infrastructure.

Dashboard/backend stores:

- agent configuration
- tenant ID
- agent ID
- environment
- voice configuration
- model configuration
- enabled tools
- business rules
- limits
- metadata

When a realtime session begins, the backend/runtime should resolve the correct tenant + agent configuration.

Conceptual flow:

Client/User
→ SaaS API
→ Authentication
→ Tenant resolution
→ Agent resolution
→ Permission/limit check
→ LiveKit session/token
→ Voice Agent Runtime

Never let a client select arbitrary privileged LiveKit configuration.

LiveKit credentials must remain server-side.

---

# 29. AGENT RUNTIME METADATA

Every call/session should be traceable using identifiers such as:

- tenantId
- agentId
- agentVersionId
- callId
- sessionId
- environment

This is critical for debugging and analytics.

---

# 30. WEBHOOKS

Create a webhook framework.

Events:

- call.started
- call.ended
- call.failed
- appointment.created
- appointment.cancelled
- customer.created
- agent.activated
- agent.paused
- usage.threshold_reached

Webhook system should support:

- signing
- retries
- exponential backoff
- delivery logs
- failure state
- idempotency

---

# 31. AUDIT LOGGING

Log security-sensitive and important actions:

- login
- logout
- tenant creation
- tenant update
- user invitation
- role change
- agent creation
- agent update
- agent publish
- agent activation
- agent pause
- integration connect/disconnect
- phone number changes
- plan changes
- limit changes
- API key changes
- sensitive settings changes

Audit log fields:

- actor
- tenant
- action
- resource
- resource ID
- timestamp
- IP metadata where appropriate
- user agent metadata where appropriate
- before/after metadata where safe

Do not log secrets.

---

# 32. SECURITY REQUIREMENTS

Implement production security fundamentals:

- Secure authentication
- Password hashing using a strong password hashing algorithm
- Session security
- CSRF protection where applicable
- Secure cookies where applicable
- Input validation
- Output validation
- Rate limiting
- Authorization checks
- Tenant isolation
- SQL injection protection through parameterized queries/ORM
- XSS protection
- Secure headers
- CORS configuration
- Secret management
- Encryption for sensitive credentials
- Audit logging
- Idempotency for sensitive operations
- Server-side usage enforcement

Never trust:

- tenantId from frontend
- role from frontend
- plan from frontend
- usage numbers from frontend
- permissions from frontend

---

# 33. API DESIGN

Create clean REST or typed API architecture according to the existing stack.

Use consistent patterns:

- authentication
- authorization
- validation
- service layer
- repository/data layer
- error handling
- pagination
- filtering
- sorting

Use consistent response/error structures.

Example:

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent was not found."
  }
}
```

Never return sensitive fields.

---

# 34. PAGINATION / SEARCH / FILTERING

All large resources should support server-side:

- pagination
- search
- filtering
- sorting

Do not load thousands of calls/customers into the browser.

Use cursor pagination where appropriate for high-volume data.

---

# 35. OBSERVABILITY

Build production observability hooks.

Track:

- API errors
- LiveKit session errors
- agent errors
- tool failures
- integration failures
- webhook failures
- database errors
- authentication failures
- latency
- usage

Use structured logging.

Every major operation should have correlation/trace identifiers.

---

# 36. ERROR HANDLING

Create proper:

- loading states
- empty states
- error states
- retry states
- permission-denied states
- not-found states
- validation errors
- rate-limit states

Do not show raw stack traces to users.

Admin logs may contain safe diagnostic information.

---

# 37. UI / UX REQUIREMENTS

Design like a serious B2B SaaS.

Use:

- consistent sidebar
- top navigation
- breadcrumbs where useful
- cards
- tables
- filters
- search
- drawers/modals
- tabs
- status badges
- confirmation dialogs
- toast notifications
- skeleton loading
- empty states

Responsive:

- Desktop
- Tablet
- Mobile

The dashboard must not break on smaller screens.

Avoid excessive rounded cards, oversized headings, unnecessary gradients, or visually noisy dashboards.

Prioritize information density and usability.

---

# 38. DESIGN SYSTEM

Create reusable components:

- Button
- Input
- Select
- MultiSelect
- DatePicker
- DataTable
- Pagination
- Modal
- Drawer
- Tabs
- Card
- Badge
- Dropdown
- Tooltip
- Toast
- Alert
- EmptyState
- Skeleton
- ConfirmDialog
- StatCard
- Chart
- StatusIndicator

Do not duplicate UI logic across pages.

---

# 39. RESPONSIVE DESIGN

Desktop:

- Full sidebar
- Data-dense tables
- Multi-column layouts

Tablet:

- Collapsible sidebar
- Responsive grids

Mobile:

- Drawer navigation
- Horizontally scrollable tables where necessary
- Stacked forms
- Touch-friendly controls
- No horizontal page overflow

Test all important pages at:

- 320px
- 375px
- 390px
- 768px
- 1024px
- 1280px
- 1440px+

---

# 40. ACCESSIBILITY

Implement:

- keyboard navigation
- focus states
- semantic HTML
- accessible labels
- proper contrast
- screen-reader-friendly controls
- error messages associated with inputs

Do not rely on color alone for status.

---

# 41. PERFORMANCE

Optimize:

- server-side pagination
- database indexes
- query efficiency
- caching where appropriate
- lazy loading
- code splitting
- image optimization
- API response size
- realtime event handling

Do not prematurely over-engineer.

---

# 42. DATA RETENTION / PRIVACY

Design configurable retention settings for:

- call records
- transcripts
- recordings
- audit logs

Do not assume all data should be stored forever.

Support future deletion/export workflows.

For call recordings and sensitive customer information, follow applicable privacy, consent, and retention requirements for the deployment region.

---

# 43. ENVIRONMENT SEPARATION

Support:

- development
- staging
- production

Never mix production and development LiveKit credentials/configuration.

Use environment variables/secrets management.

---

# 44. CONFIGURATION MANAGEMENT

Use centralized configuration.

Examples:

- database URL
- LiveKit URL
- LiveKit API key
- LiveKit API secret
- provider keys
- webhook secrets
- encryption key

Never hardcode secrets.

Never commit secrets to Git.

---

# 45. SEED DATA

Create development seed data only.

Example tenants:

- Demo Dental
- Demo Clinic
- Demo Gym

Clearly mark them as demo/test tenants.

Production should not rely on seed data.

---

# 46. TESTING

Create tests for critical areas.

## Unit

- entitlement calculations
- permission checks
- validation
- usage calculations

## Integration

- authentication
- tenant isolation
- agent CRUD
- user management
- call access
- usage enforcement

## Security

Explicitly test:

- cross-tenant access
- IDOR
- privilege escalation
- unauthorized agent access
- unauthorized integration access

## E2E

Test:

1. Admin creates tenant
2. Admin invites client
3. Client logs in
4. Client creates/configures agent
5. Agent is published
6. Call is created
7. Call appears in history
8. Usage increments
9. Limit is enforced
10. Audit event is created

---

# 47. DATABASE MIGRATIONS

Use proper migrations.

Never make undocumented production schema changes.

All schema changes must be reproducible.

---

# 48. DOCUMENTATION

Generate:

- README
- Architecture documentation
- Environment setup
- Database setup
- Migration instructions
- Authentication flow
- RBAC documentation
- Multi-tenancy documentation
- API documentation
- LiveKit integration boundary documentation
- Deployment guide
- Production checklist
- Troubleshooting guide

---

# 49. ADMIN SUPPORT / IMPERSONATION

If implementing impersonation:

- require elevated role
- require explicit action
- show a persistent "Support Mode" indicator
- log the action
- record actor and target tenant
- never expose credentials
- allow immediate exit

Do not silently impersonate users.

---

# 50. SYSTEM HEALTH

Admin-only page.

Show:

- API health
- Database health
- LiveKit health
- Worker health
- Queue health if applicable
- Integration health
- Webhook health
- Recent critical errors

Use real health checks where possible.

---

# 51. NOTIFICATIONS

Build notification infrastructure.

Types:

- usage warning
- agent error
- integration disconnected
- webhook failure
- subscription issue
- system alert

Support in-app notifications first.

Keep email/SMS notification architecture extensible.

---

# 52. API KEYS

If API access is implemented:

- tenant-scoped API keys
- hashed storage where possible
- show secret only once
- revoke
- rotate
- last used
- created by
- scopes

Never store/display raw API secrets unnecessarily.

---

# 53. IDEMPOTENCY

Use idempotency for operations such as:

- payment events
- webhook processing
- appointment creation where duplicate risk exists
- external integration events
- provisioning actions

Prevent duplicate operations.

---

# 54. STATUS MODEL

Use consistent statuses.

Tenant:

- TRIAL
- ACTIVE
- SUSPENDED
- CANCELLED
- ARCHIVED

Agent:

- DRAFT
- CONFIGURING
- TESTING
- ACTIVE
- PAUSED
- ERROR
- ARCHIVED

Integration:

- CONNECTED
- DISCONNECTED
- ERROR
- SYNCING

Call:

- INITIATED
- RINGING
- IN_PROGRESS
- COMPLETED
- FAILED
- TRANSFERRED
- MISSED

---

# 55. SEARCH

Global/admin search should be future-ready for:

- tenants
- users
- agents
- calls
- phone numbers

Tenant search only searches tenant-owned data.

---

# 56. ROUTING

Use clear application routes.

Conceptual:

```text
/auth/login

/admin
/admin/clients
/admin/clients/:tenantId
/admin/agents
/admin/calls
/admin/usage
/admin/plans
/admin/billing
/admin/integrations
/admin/system-health
/admin/audit-logs

/app
/app/agents
/app/agents/:agentId
/app/calls
/app/calls/:callId
/app/appointments
/app/customers
/app/customers/:customerId
/app/phone-numbers
/app/knowledge
/app/integrations
/app/analytics
/app/usage
/app/team
/app/settings
```

Adjust routing to the framework already present in the repository.

---

# 57. BACKEND SERVICE BOUNDARIES

Keep business logic separated into services/modules:

- AuthService
- TenantService
- UserService
- PermissionService
- AgentService
- AgentVersionService
- CallService
- AppointmentService
- CustomerService
- PhoneService
- KnowledgeService
- IntegrationService
- UsageService
- EntitlementService
- BillingService
- WebhookService
- AuditService
- LiveKitService
- NotificationService

Do not place all business logic inside route/controller files.

---

# 58. LIVEKIT SERVICE

Create a dedicated LiveKit integration service.

Responsibilities:

- create/access sessions where appropriate
- generate secure tokens server-side
- attach tenant/agent metadata
- validate agent access
- enforce limits before session creation
- record lifecycle events
- correlate sessions with calls
- expose safe status to dashboard

Never expose:

- LiveKit API secret
- privileged provider credentials
- internal agent runtime credentials

---

# 59. AGENT CONFIGURATION SCHEMA

Create a normalized but practical agent configuration.

Conceptual:

```text
Agent
├── identity
├── voice
├── model
├── prompt
├── conversation
├── business_hours
├── transfer
├── fallback
├── tools
├── knowledge
├── integrations
└── runtime
```

Agent configuration must be versionable.

---

# 60. USAGE EVENT PIPELINE

Do not calculate all usage from frontend events.

Usage should be derived from trusted backend/runtime events.

Example:

```text
LiveKit session
      ↓
Call lifecycle event
      ↓
Usage service
      ↓
Usage record
      ↓
Daily aggregate
      ↓
Monthly aggregate
      ↓
Entitlement check
      ↓
Dashboard
```

Use idempotency so the same event cannot double-charge usage.

---

# 61. REALTIME DASHBOARD

Where useful, provide realtime updates for:

- active calls
- agent status
- current call state
- system status

Do not poll aggressively if websocket/realtime events are available.

---

# 62. EMPTY STATES

Every new tenant may have zero data.

Create meaningful empty states.

Example:

"No voice agents yet"

"Create your first voice agent to start receiving AI-powered calls."

Buttons should lead to the correct action.

Never show broken charts or fake numbers.

---

# 63. LOADING STATES

Every asynchronous page must have proper loading UX.

Use skeletons rather than blank screens.

---

# 64. FORM UX

Forms should support:

- validation
- inline errors
- autosave only where appropriate
- unsaved changes warnings
- cancel
- reset
- save
- publish where applicable

Dangerous actions require confirmation.

---

# 65. PRODUCTION-READY QUALITY BAR

Before considering the implementation complete, verify:

- No fake backend operations
- No hardcoded production secrets
- No cross-tenant data leakage
- No client-side-only authorization
- No client-side-only usage limits
- No unprotected admin routes
- No broken responsive layouts
- No console errors
- No obvious accessibility failures
- No raw server errors exposed to users
- No duplicate business logic
- No undocumented environment variables
- No missing database migrations
- No unhandled critical failures

---

# 66. IMPLEMENTATION STRATEGY

Do not attempt to build everything as one giant unstructured implementation.

Implement in vertical slices while keeping the architecture production-ready.

Recommended sequence:

### Phase 1

- App shell
- Authentication
- RBAC
- Tenant model
- Admin/client route separation

### Phase 2

- Admin client management
- Client onboarding wizard
- Tenant settings
- Team management

### Phase 3

- Agent management
- Agent configuration
- Agent versioning
- Test experience

### Phase 4

- Calls
- Call details
- Transcript
- Analytics

### Phase 5

- Usage
- Entitlements
- Limits
- Plan management

### Phase 6

- Phone numbers
- Knowledge base
- Integrations

### Phase 7

- LiveKit integration boundary
- Realtime sessions
- Agent runtime metadata
- Realtime call status

### Phase 8

- Audit logs
- System health
- Webhooks
- Notifications
- Production hardening

---

# 67. IMPORTANT DEVELOPMENT RULES

If an existing repository is provided:

1. Inspect the existing architecture first.
2. Reuse existing technologies when sensible.
3. Do not rewrite the entire project unnecessarily.
4. Preserve working features.
5. Identify existing auth/database/UI patterns.
6. Follow existing linting and formatting rules.
7. Add functionality incrementally.
8. Keep changes modular.
9. Run tests/build/lint after major changes.
10. Fix regressions before continuing.

If no stack is specified, choose a modern production-ready stack suitable for a B2B SaaS and document the choice.

Prefer:

- TypeScript
- PostgreSQL
- secure authentication
- typed API layer
- ORM/query layer
- component-based frontend
- reusable UI system
- server-side authorization
- structured logging
- migration tooling

Do not introduce unnecessary technologies.

---

# 68. FINAL ACCEPTANCE CRITERIA

The completed Z Call Agent SaaS Dashboard + Backend must allow the internal Z Call Agent team to:

1. Create a client/tenant.
2. Configure client business details.
3. Assign a plan.
4. Set client limits.
5. Create/invite client users.
6. Create multiple voice agents.
7. Configure each agent independently.
8. Version and publish agent configurations.
9. Configure tools.
10. Configure business hours.
11. Configure transfer rules.
12. Manage phone numbers.
13. Manage knowledge.
14. Manage integrations.
15. View calls.
16. View transcripts.
17. View summaries.
18. View appointments.
19. View customers.
20. View analytics.
21. Track usage.
22. Enforce limits.
23. Audit important actions.
24. Monitor system health.
25. Connect the platform to LiveKit without exposing secrets.

The completed client portal must allow a tenant to:

1. Login securely.
2. See only its own data.
3. Manage authorized users.
4. Manage its voice agents.
5. Configure agents according to permissions.
6. Test agents.
7. View calls.
8. View transcripts/summaries.
9. Manage appointments.
10. Manage customers.
11. Manage phone numbers.
12. Manage knowledge.
13. Manage integrations.
14. View analytics.
15. View usage and limits.
16. Manage settings.

---

# 69. MOST IMPORTANT SECURITY ACCEPTANCE TEST

Create two test tenants:

```text
Tenant A
Tenant B
```

Create data for both.

Then verify:

- Tenant A cannot access Tenant B's API resources.
- Tenant A cannot access Tenant B's calls.
- Tenant A cannot access Tenant B's agents.
- Tenant A cannot access Tenant B's users.
- Tenant A cannot access Tenant B's integrations.
- Tenant A cannot manipulate Tenant B's usage.
- Tenant A cannot manipulate Tenant B's plan.
- Tenant A cannot generate a LiveKit session for Tenant B's agent.

Also verify:

- STAFF cannot perform OWNER actions.
- VIEWER cannot mutate data.
- Tenant users cannot access `/admin`.
- Platform users have only the permissions appropriate to their role.

---

# 70. FINAL BUILD INSTRUCTION

Build **Z Call Agent** as a real production-oriented SaaS control plane, not as a static dashboard mockup.

Prioritize:

**Security → Tenant Isolation → Correct Data Model → RBAC → Backend correctness → LiveKit boundary → Usage enforcement → UX → Analytics → Visual polish**

Every page should connect to the correct backend/domain model.

Every important action should have:

- validation
- authorization
- error handling
- loading state
- success state
- auditability where appropriate

Use realistic empty states instead of fake data.

Use seed/demo data only in development.

Keep the architecture modular so additional voice providers, LLM providers, STT/TTS providers, telephony providers, CRMs, calendars, and communication channels can be added later without redesigning the entire SaaS.

The final result should feel like a **serious B2B AI voice infrastructure SaaS**, comparable in product quality to modern SaaS admin platforms, while remaining simple enough for a small team to operate and scale.
