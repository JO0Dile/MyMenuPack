# The smart assistant — setup

The assistant has two brains.

**Offline brain** (`web/js/41-…` to `43-…`) — ships with the app, needs no
setup, works with no connection, and cannot be wrong about your data because it
only ever reads it. It is also limited: it matches phrasing it recognises, and
says "I don't have that information" for everything else.

**Smart brain** (this folder) — a real language model. It understands ordinary
questions, answers in fluent English or Arabic, and can operate the app:
navigate, run walkthroughs, and propose changes to a student's progress. It
needs a connection and the Worker below.

The app tries the smart brain first, and falls back to the offline one whenever
there is no connection, no Worker, or the daily free quota is spent. A student
never sees a dead chat.

---

## What it costs

Nothing. Every tier is a free allowance, and the Worker walks down the list as
each is exhausted:

| Tier | Free allowance | Notes |
|---|---|---|
| `gemini-flash-latest` | ~250 requests/day | Best answers, clearly best Arabic |
| `gemini-flash-lite-latest` | ~1,000 requests/day | Weaker, still good |
| Cloudflare Workers AI (Llama 3.1 8B) | 10,000 neurons/day ≈ ~600 chats | Text only, no app-driving |
| Offline engine, in the app | unlimited | Works on a plane |

Neither Gemini's free tier nor Cloudflare's asks for a credit card, so there is
no way for this to quietly start charging you. If every tier is spent, the
assistant degrades to the offline engine and says so.

> Those two are **aliases**, not pinned versions, on purpose. Pinned model
> names expire: `gemini-2.5-flash` already returns *404 — no longer available
> to new users* for a freshly created key, which would take this Worker's first
> tier down with it. The aliases follow whatever the current Flash generation
> is. Both the model list and the fallback are environment variables anyway, so
> keeping up is a dashboard edit, never a code change.

---

## Setup — 3 steps, about 3 minutes

Everything that could be done in advance already has been: the app is
**already pointing at** `https://studyplan-ai.pmhtrfalab999.workers.dev`, the
allowed origin already defaults to this site, and the model list already
defaults to working aliases. Nothing below needs editing afterwards.

Until the Worker exists the app simply falls back to its on-device assistant —
so there is no rush and nothing is broken in the meantime.

### 1. Create the Worker

Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**.

**Name it exactly `studyplan-ai`.** That is what makes the URL match what the
app already expects. (If you name it something else, change `APP_AI_URL` in
`web/js/01-catalogue.js` to match.)

Click **Deploy**. Then **Edit code**, select everything in the editor, delete
it, paste in the whole of `ai/cloudflare-worker.js` from this repo, and
**Deploy** again.

### 2. Add the key

**Settings → Variables and Secrets → Add**

- Type: **Secret** ← must be Secret, not Text
- Name: `GEMINI_API_KEY`
- Value: your key from https://aistudio.google.com/apikey

**Deploy**. That is the last required step.

### 3. (Optional) Add the free fallback

**Settings → Bindings → Add → Workers AI**, variable name exactly `AI`.

This is the third free tier — it takes over if Gemini's daily quota runs out.
Skipping it just means the app falls back to its on-device assistant instead,
which is not a failure, only a less clever answer.

### Check it worked

Open `https://studyplan-ai.pmhtrfalab999.workers.dev` in a browser. It reports
its own configuration without ever revealing the key:

```json
{ "ok": true, "gemini": true, "workersAI": true,
  "models": ["gemini-flash-latest", "gemini-flash-lite-latest"] }
```

`gemini: false` means step 2 did not save. `workersAI: false` means step 3 was
skipped, which is fine.

Then open the app, tap 💬, and accept the one-time prompt. The header shows ✨
when the smart brain is answering.

---

## Optional variables

| Name | Default | What it does |
|---|---|---|
| `GEMINI_MODELS` | `gemini-flash-latest,gemini-flash-lite-latest` | Models to try, in order |
| `CF_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | The Workers AI model |
| `RATE_PER_MIN` | `8` | Questions per minute, per device |
| `RATE_PER_DAY` | `120` | Questions per day, per device |
| `MAX_CHARS` | `24000` | Cap on the grounding data per request |
| `SHARED_SECRET` | *(unset)* | If set, the app must send it in `x-app-secret` |

---

## How it stays honest

**The key is never in the app.** GitHub Pages serves static files that anyone
can read. The key lives only in the Worker's secrets, and the Worker sends it
in the `x-goog-api-key` header rather than the URL — query strings end up in
logs, caches, and referrer headers.

**If a key is ever pasted anywhere else** — a chat, a file, a screenshot, a
commit — treat it as burned. Delete it in AI Studio and create a new one. It
takes ten seconds and it is the only way to be sure.

**The rules are never in the app either.** The system prompt and the list of
things the model is allowed to do live in this Worker, not in `web/js/`. A
student who opens devtools can change what their own browser sends, but cannot
rewrite the assistant's instructions.

**The model is grounded, not trusted.** Every request carries a CONTEXT block
built from the data already on the student's device — their plan, its courses,
prerequisites, credit hours, and their progress. The prompt tells the model to
answer only from that, and to say "I don't have that information because it
isn't part of this website" otherwise. That is a strong instruction, not a
guarantee: a language model can drift in a way the offline engine structurally
cannot. It is the trade for actually understanding the question.

**Nothing writes without a human.** The model cannot change a student's record.
Its two editing tools are named `propose_` because that is all they do — the
app turns them into a confirmation card describing the change, and nothing is
saved until the student taps it.

**CONTEXT is data, never instructions.** Course names can come from another
student's device via the Contribute flow, so the prompt states plainly that
anything inside CONTEXT is data and must never be followed as an instruction.

---

## What gets sent, exactly

Only when a student turns the smart assistant on, and only then:

**Sent:** their question, the name of the plan they have open, its course list
with credit hours and prerequisites, which courses they have marked completed,
their credit-hour totals, and their GPA number if they have one.

**Never sent:** their name, student ID, individual course grades, assessment
marks, personal notes, or difficulty ratings.

With the smart assistant off — which is the default — nothing leaves the device
at all, and the offline brain answers.
