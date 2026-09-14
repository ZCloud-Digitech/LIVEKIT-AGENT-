# Z Call Agent — Production SaaS Platform Documentation
### (English Documentation with Tanglish Explanations)

Welcome to **Z Call Agent**, an enterprise-grade multi-tenant B2B SaaS control plane for deploying, versioning, monitoring, and testing realtime AI voice agents powered by **LiveKit**, **Deepgram (STT)**, **Cartesia (TTS)**, and **GPT-4o (LLM)**.

> 💡 **Tanglish Quick Note:**
> Idhu oru complete **AI Voice Agent SaaS platform**. Oru clinic, hospital, gym, illa business-ku AI phone receptionist setup panni, call attend panradhu, calendar check panni appointment book panradhu, call transcript edukuradhu — idhu ellathayum control panra master dashboard idhu.

---

## 📑 Table of Contents (பொருளடக்கம்)
1. [Architecture & How It Works (Eppadi Work Aagudhu?)](#1-architecture--how-it-works-eppadi-work-aagudhu)
2. [How to Run Locally (Eppadi Run Panradhu?)](#2-how-to-run-locally-eppadi-run-panradhu)
3. [Test Login Credentials (Yaar Yaar Login Panna Mudiyum?)](#3-test-login-credentials-yaar-yaar-login-panna-mudiyum)
4. [Client Portal Walkthrough (`/app`)](#4-client-portal-walkthrough-app)
   - [Overview & KPI Metrics](#overview--kpi-metrics)
   - [Voice Agents & Versioning (v1 → v2)](#voice-agents--versioning-v1--v2)
   - [Interactive Voice Test Workbench](#interactive-voice-test-workbench)
   - [Calls & Transcripts with Tool Calling](#calls--transcripts-with-tool-calling)
   - [Appointments & Customer CRM](#appointments--customer-crm)
   - [Usage & Quota Limits (70% - 100%)](#usage--quota-limits-70---100)
5. [Platform Admin Console (`/admin`)](#5-platform-admin-console-admin)
   - [Client Management & Support Mode (Impersonation)](#client-management--support-mode-impersonation)
   - [11-Step Client Onboarding Wizard](#11-step-client-onboarding-wizard)
   - [System Health & Audit Logs](#system-health--audit-logs)
6. [Security & LiveKit Boundary (Security Eppadi Protect Aagudhu?)](#6-security--livekit-boundary-security-eppadi-protect-aagudhu)

---

## 1. Architecture & How It Works (Eppadi Work Aagudhu?)

The system operates as a centralized **Control Plane** managing multiple isolated business clients (**Tenants**). LiveKit handles the WebRTC voice execution, while the Next.js control plane manages configurations, business rules, tool permissions, call history, and limits.

### System Flow Diagram:

```text
[ Incoming Phone Call / Test Mic ]
               │
               ▼
[ Z Call Agent Control Plane (Backend) ]
   ├─ Step 1: Tenant Resolution (Identifies which clinic is being called)
   ├─ Step 2: Quota & Entitlement Check (Checks if monthly minutes remain)
   └─ Step 3: Server-side LiveKit JWT Token Generation (No secrets exposed)
               │
               ▼
[ Realtime LiveKit Mesh & AI Agents ]
   ├─ Speech-to-Text (STT): Deepgram converts voice to text
   ├─ Reasoning & Function Calling: GPT-4o triggers tools (e.g. check_availability)
   └─ Text-to-Speech (TTS): Cartesia speaks back with ultra-low latency (<150ms)
               │
               ▼
[ Instant Control Plane Database Sync ]
   ├─ Full dialogue saved to CallTranscripts with millisecond timestamps
   ├─ Appointments automatically inserted into CRM database
   └─ Billed voice minutes added to tenant usage records
```

> 💡 **Tanglish Explanation (Idhu Eppadi Work Aagudhu?):**
> 1. Customer clinic-ku phone call pannumpodho, illa namba test workbench-la mic on pannumpodho call start aagum.
> 2. Backend first check pannum: "Ivaingalukku plan-la minutes irukka? Idhu entha clinic-oda agent?".
> 3. Backend-la LiveKit session token create aagi WebRTC audio connect aagum.
> 4. Customer *"Naalaiku 10:30 AM appointment venum"* nu sonna, AI agent automatic-ah `check_availability()` tool-ah run panni, *"10:30 AM free-ah irukku, book pannava?"* nu voice-la pesum.
> 5. Call mudinjathum, full transcript, call recording, and appointment details automatic-ah database-la save aagidum.

---

## 2. How to Run Locally (Eppadi Run Panradhu?)

Follow these 4 simple steps to run the complete stack on your local machine:

### Step 1: Install Dependencies
```bash
npm install
```
> 💡 *Tanglish:* Ella required npm packages (Next.js 15, Prisma, bcryptjs, jsonwebtoken, Lucide icons) install aagum.

### Step 2: Push Database Schema (SQLite / PostgreSQL)
```bash
npx prisma db push
```
> 💡 *Tanglish:* Local SQLite database (`dev.db`) automatic-ah create aagi, multi-tenant tables ready aagidum.

### Step 3: Seed Demo Data (Test Tenants & Agents)
```bash
npm run seed
```
> 💡 *Tanglish:* Demo data create aagum: Super Admin, Tenant A (*Apex Dental Care*), Tenant B (*Metro Health Clinic*), ready-made Voice Agents, calls, and appointments.

### Step 4: Start the Application
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:3000`**.

---

## 3. Test Login Credentials (Yaar Yaar Login Panna Mudiyum?)

Default Password for all seeded evaluation accounts: **`Password123!`**

| Account Role | Email Address | Password | Landing URL | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Super Admin** | `admin@zcallagent.ai` | `Password123!` | `/admin` | Internal Z Call Agent master dashboard |
| **Tenant A Owner** | `owner@apexdental.com` | `Password123!` | `/app` | Apex Dental Care owner (full access) |
| **Tenant A Staff** | `sarah@apexdental.com` | `Password123!` | `/app` | Apex Dental front-desk staff (read/calls) |
| **Tenant B Owner** | `owner@metrohealth.com` | `Password123!` | `/app` | Metro Health Clinic owner (isolated data) |

> 💡 **Tanglish Quick Tip:**
> Login page (`/auth/login`)-ku pona udaney, keezha irukra **Quick Test Credentials** button-ah click panna podhum! Email & Password auto-fill aagi single click-la login aagidum.

---

## 4. Client Portal Walkthrough (`/app`)

When a client logs in (e.g., `owner@apexdental.com`), they access their private, tenant-isolated workspace.

### Overview & KPI Metrics
- **Calls Today & Weekly Trends**: Real-time counter of inbound and outbound calls.
- **Voice Minutes Meter**: Visual progress bar showing minutes used vs plan limit (e.g., 1627 / 2500 min).
- **Upcoming Appointments**: Counts appointments scheduled by voice agents.
- **Resolution Rate**: Percentage of calls resolved without needing a human transfer (e.g., 94%+).

> 💡 **Tanglish Note:**
> Business owner login panna udaney, innaiku evlo calls vandhuchu, AI evlo appointment book pannirukku, evlo minutes use aagiyirukku nu clean stats card-la theriyum.

---

### Voice Agents & Versioning (v1 → v2)
Navigate to **Voice Agents (`/app/agents`)**:
- Each agent has its own status (`ACTIVE`, `PAUSED`, `CONFIGURING`), assigned phone number, and voice engine.
- Open **Agent Configuration (`/app/agents/[id]`)**:
  - **Greeting & Persona**: What the agent says when picking up the phone.
  - **Voice Synthesizer**: Choose ultra-fast voices (Cartesia Sonic, ElevenLabs, Deepgram Aura).
  - **Model & Speed**: Select GPT-4o Mini and adjust speaking speed (0.8x to 1.3x).
  - **Tools Toggles**: Enable or disable functions like `check_availability`, `book_appointment`, `transfer_call`.
- **Immutable Versioning (`/app/agents/[id]/versions`)**:
  - Every update creates a safe version snapshot (`v1 → v2 → v3`).
  - You can publish a version or perform an instant **1-Click Rollback** if an edit had issues.

> 💡 **Tanglish Note:**
> Agent settings-la greeting, speaking speed, model ellam change pannalam. Prod-la direct-ah overwrite aagathu; v1, v2 nu versions save aagum. Yedhavathu thappana settings pota, single click-la pazhaya version-ku **Rollback** pannikalam!

---

### Interactive Voice Test Workbench
Navigate to **`/app/agents/[id]/test`**:
- An in-browser live testing environment.
- Click **"Start Realtime Test Session"**:
  1. LiveKit WebRTC session connects immediately.
  2. The **Audio Waveform** animates in real-time as the agent speaks.
  3. Speak into your microphone or type in the test box:
     > *"Hi Chloe, I want to book an appointment tomorrow morning."*
  4. Notice the agent trigger the live tool:
     ```text
     TOOL: check_availability(date="2026-09-15", service="Hygiene")
     RESULT: {"slots":["10:30 AM", "02:00 PM", "04:15 PM"]}
     AGENT: "We have 10:30 AM, 2:00 PM, and 4:15 PM available tomorrow. Which works for you?"
     ```
  5. Click **"End Test Session"**: The call record is automatically saved to the Call History and voice minutes are billed to the tenant.

> 💡 **Tanglish Note:**
> Idhu dhaan namba platform-oda highlight feature! Real phone line illamalaye, browser-leye mic on panni agent kitta direct-ah pesi test pannalam. AI epdi reply pannudhu, calendar tool-ah epdi call pannudhu nu live timeline-la kannu munnadiye paarkalam.

---

### Calls & Transcripts with Tool Calling
Navigate to **`/app/calls`**:
- Filter calls by outcome (`APPOINTMENT_BOOKED`, `RESOLVED`, `TRANSFERRED`).
- Open **Call Details (`/app/calls/[id]`)**:
  - **AI Executive Summary**: Brief bullet points of what occurred during the call.
  - **Audio Recording Playback Bar**: Listen to the recorded call (with an automatic graceful fallback state if recording was disabled).
  - **Chronological Dialogue**: Turn-by-turn chat bubbles with speaker diarization (`AGENT` vs `CUSTOMER`), millisecond latencies, and tool execution logs.

> 💡 **Tanglish Note:**
> Nadandha ella calls-um inga save aagum. Oru call-ah open panna, full audio recording kekkalam, AI summary padikkalam, and endha second-la agent endha tool-ah run pannuchu nu complete timeline-oda paarkalam.

---

### Appointments & Customer CRM
- **Appointments (`/app/appointments`)**:
  - View all scheduled bookings with customer details, date, time, duration, and status (`UPCOMING`, `COMPLETED`, `CANCELLED`).
- **Customers CRM (`/app/customers`)**:
  - Directory of all callers with their total calls, appointment history, tags (e.g. `VIP`, `MetLife`), and patient notes.

> 💡 **Tanglish Note:**
> AI book panra ella appointments-um inga list aagum. Customer-oda phone number, email, previous call history ellame automatic CRM-la store aagidum.

---

### Usage & Quota Limits (70% - 100%)
Navigate to **`/app/usage`**:
- Visual meters for **Voice Minutes**, **Active Agents**, **Team Seats**, and **Phone Numbers**.
- **Server-Side Enforcement**: Once 100% of plan minutes are exhausted, the backend blocks new call generation.
- **Warning Banners**: The UI automatically displays alert banners when usage crosses **70%**, **85%**, **95%**, and **100%**.

> 💡 **Tanglish Note:**
> Free/Pro plan-la kodutha minutes evlo use aayirukku nu meter-la kaattum. 70% mela poiduchuna warning alert varum. 100% reach aana backend-la automatic-ah block aagidum.

---

## 5. Platform Admin Console (`/admin`)

The internal administration area reserved exclusively for the Z Call Agent leadership and engineering team.

### Client Management & Support Mode (Impersonation)
Navigate to **`/admin/clients`**:
- View all tenants, their subscription plans, active agents, total call volume, and status (`ACTIVE`, `SUSPENDED`).
- **Support Mode (Impersonation)**:
  - If a customer needs help, click **"Support Mode"** next to their business.
  - The admin seamlessly enters the customer's portal without needing their password.
  - A prominent red banner displays: **"Support Mode Active: You are viewing Apex Dental Care..."**.
  - All actions performed in Support Mode are recorded in the immutable audit log.
  - Click **"Exit Support Mode"** at any time to instantly return to `/admin`.

> 💡 **Tanglish Note:**
> Oru client-ku yedhavathu issue vandha, Super Admin password kekkama direct-ah **Support Mode** click panni avanga account-ku poyi fix pannalam. Mela red banner theriyum, and exit pannathum thirumba admin console-ku vandhuralam.

---

### 11-Step Client Onboarding Wizard
Navigate to **`/admin/onboarding`**:
A step-by-step enterprise onboarding wizard to provision a new client:
1. **Business Details**: Name, industry, timezone, address, email.
2. **Primary Contact**: Decision maker details.
3. **Plan Selection**: Free, Starter, Pro, or Enterprise.
4. **Initial Admin User**: Sets up the tenant owner account.
5. **Voice Agent Setup**: Default persona, greeting, and model.
6. **Knowledge Base**: Attach initial FAQs or clinic guidelines.
7. **Tools Enablement**: Toggle scheduling, SMS, and transfer capabilities.
8. **Integrations**: Connect Google Calendar and Twilio trunks.
9. **Phone Number**: Assign an inbound DID phone line.
10. **Pre-Launch Checklist**: Automated sanity check of tenant parameters.
11. **Deploy & Activate**: Provisions database workspace and dispatches welcome invite!

> 💡 **Tanglish Note:**
> Pudhu client onboard panna 11 simple steps irukku. Company details, plan, phone number, agent details select panni **Deploy** kudutha, automatic-ah full setup create aagidum!

---

### System Health & Audit Logs
- **System Health (`/admin/system-health`)**: Realtime health checks of PostgreSQL/SQLite control plane latency, LiveKit WebRTC mesh status (14ms latency), and speech worker queues.
- **Audit Logs (`/admin/audit-logs`)**: Cryptographic trail of all logins, agent modifications, support mode sessions, and status changes.

---

## 6. Security & LiveKit Boundary (Security Eppadi Protect Aagudhu?)

1. **Strict Multi-Tenant Isolation (Zero IDOR)**:
   - Tenant A (`owner@apexdental.com`) cannot view, query, or mutate Tenant B (`owner@metrohealth.com`) data.
   - Tenant ID is **never trusted from the browser**; it is verified solely from the cryptographic HTTP-only session cookie.

2. **LiveKit Security Boundary**:
   - LiveKit API Key, API Secret, and LLM provider credentials **never reach the client browser**.
   - Sessions generate single-use, server-signed JWT tokens on demand with attached tenant and room metadata.

### Run the Security Test Suite:
To verify the multi-tenant isolation and IDOR protection, execute:
```bash
npm run test:isolation
```
**Test Results:**
```text
🔒 Running Z Call Agent Multi-Tenant Security & IDOR Acceptance Tests...
✅ TEST 1 PASSED: Cross-tenant access from Tenant A to Tenant B blocked.
✅ TEST 2 PASSED: Tenant A access to Tenant A succeeded.
✅ TEST 3 PASSED: Tenant A cannot generate LiveKit token for Tenant B agent.
✅ TEST 4 PASSED: Tenant user blocked from platform admin area.
✅ TEST 5 PASSED: Platform Admin authorized for platform area.
✅ TEST 6 PASSED: VIEWER blocked from performing OWNER operations.

🛡️ All 6/6 Multi-Tenant Security Acceptance Tests PASSED!
```

---

## 🎯 Summary Checklist (சுருக்கம்)
- [x] Run `npm run dev` and open `http://localhost:3000`.
- [x] Go to `/auth/login` and click **Tenant A Owner** to sign in.
- [x] Explore `/app/agents` and test Chloe in the **Test Workbench** with voice and tools.
- [x] Inspect call transcripts at `/app/calls`.
- [x] Log in as Super Admin (`admin@zcallagent.ai`) to explore `/admin` and the **11-Step Onboarding Wizard**!
