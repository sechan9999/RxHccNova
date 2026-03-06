# RxHCC FWA Detection System — Testing Guide

> **App**: http://localhost:5173  
> **Repo**: https://github.com/sechan9999/RxHccNova  
> **Stack**: React 19, Vite 7, Tailwind CSS 3, Amazon Nova (Bedrock)

---

## 1. Environment Setup

### 1.1 Install & Launch

```bash
git clone https://github.com/sechan9999/RxHccNova.git
cd RxHccNova
npm install          # installs React, Vite, Tailwind, Lucide
npm run dev          # starts dev server
```

**Expected**: Terminal shows `VITE ready in XX ms  ➜  Local: http://localhost:5173/`

### 1.2 Page Load Verification

| Check | Expected Result |
|-------|----------------|
| Open `http://localhost:5173/` | Dark navy background loads |
| Header | **RxHCC Fraud Detection** title with shield icon |
| Mode badge | **Rule-Based Mode** (yellow/amber pill) — no API configured yet |
| Navigation | 5 tabs visible: Single Claim · Batch Analysis · Network Graph · Temporal Analysis · AI Investigator |
| Footer | "RxHCC Fraud Detection System • Amazon Nova Integration" |
| Console errors | **None** |

---

## 2. Tab 1 — Single Claim Analysis

### TC-01: Scenario List Renders

**Steps**: Open app → verify Single Claim tab is active by default  
**Expected**: 5 scenario cards displayed:
- GLP-1 Off-Label Misuse
- HCC Upcoding Scheme
- Oncology Drug Diversion
- Normal Diabetic Care
- Duplicate Billing Pattern

---

### TC-02: GLP-1 Off-Label Misuse (CRITICAL flag)

**Steps**: Click **"GLP-1 Off-Label Misuse"** → click **"Analyze Claim"**

**Expected — Rule Engine panel**:
```
Risk Level: CRITICAL
Violation: NDC_DIAGNOSIS_MISMATCH
Drug: Ozempic (Semaglutide) 1mg
Required Diagnosis: Type 2 DM or Obesity
Actual Diagnosis: I10 (Hypertension only)
Billed Amount: $936.00
```

**Expected — AI Analysis panel**:
```json
{
  "riskLevel": "HIGH",
  "fraudProbability": 0.85,
  "recommendedAction": "BLOCK",
  "reasoning": "Semaglutide is only FDA-approved for T2DM and obesity..."
}
```

**Verify**: AI result is rendered as structured cards (NOT raw JSON)

---

### TC-03: HCC Upcoding Scheme (HIGH flag)

**Steps**: Click **"HCC Upcoding Scheme"** → **"Analyze Claim"**

**Expected**: Rule engine detects `HCC_UPCODING_SUSPECT`  
HCC combined score > 1.5 (ESRD=0.289 + COPD=0.335 + Cirrhosis=0.363 = **1.987**)

---

### TC-04: Oncology Drug Diversion (CRITICAL flag)

**Steps**: Click **"Oncology Drug Diversion"** → **"Analyze Claim"**

**Expected**:  
- NDC `00006-3024-02` (Keytruda, $10,897) flagged  
- Diagnosis `I10` only — no cancer code `C34.90`  
- `NDC_DIAGNOSIS_MISMATCH` CRITICAL violation

---

### TC-05: Normal Diabetic Care (CLEAN)

**Steps**: Click **"Normal Diabetic Care"** → **"Analyze Claim"**

**Expected**:
```
Risk Level: LOW
Status: ✅ Clean — No violations detected
```
Ozempic (NDC `00169-4132-12`) + Diagnosis `E11.9` (T2DM) → valid indication match

---

### TC-06: Duplicate Billing Pattern (HIGH flag)

**Steps**: Click **"Duplicate Billing Pattern"** → **"Analyze Claim"**

**Expected**: `DUPLICATE_NDC` violation — NDC `00002-4462-01` appears twice  
Rule: duplicate NDC in same claim → fraud indicator

---

## 3. Tab 2 — Batch Analysis

### TC-07: Generate Batch

**Steps**: Click **"Batch Analysis"** tab → click **"Generate & Analyze 500 Claims"**

**Wait**: ~5–10 seconds for processing  

**Expected summary cards**:
| Metric | Expected Range |
|--------|--------------|
| Total Claims | **500** |
| Flagged Claims | **55–80** (≈13–16%) |
| At-Risk Amount | **$100,000 – $250,000** |
| Flagged Providers | **3–8** |

---

### TC-08: Anomaly Type Breakdown

**Expected anomaly types** (all 5 should appear after batch):

| Type | Description |
|------|------------|
| `NDC_DIAGNOSIS_MISMATCH` | Drug prescribed without valid indication |
| `HCC_UPCODING_SUSPECT` | Combined HCC risk > 1.5 |
| `DUPLICATE_NDC` | Same drug billed twice on one claim |
| `OUTLIER_BILLING` | Amount > 3× drug's average cost |
| `CLEAN` | No violations |

---

### TC-09: Flagged Claims Table

**Expected**: Table with columns — Claim ID · Provider · Date · Diagnoses · NDC Codes · Billed · Risk · Action  
**Verify**: Risk badges (CRITICAL=red, HIGH=amber, MEDIUM=yellow, LOW=green) display correctly

---

## 4. Tab 3 — Network Graph Analysis

### TC-10: Network Graph Renders After Batch

**Pre-condition**: Batch Analysis must be run first (TC-07)  

**Expected sections**:
1. **Network Statistics** — Provider Nodes count, Patient Nodes count, Total Connections
2. **Hub Providers** — Providers with > 5 connections (suspicious centrality)
3. **Doctor Shopping** — Patients who visited 3+ different providers
4. **Suspicious Provider Pairs** — Provider pairs with high shared violation rates

---

### TC-11: Network Empty State

**Steps**: Reload app (F5) → click Network Graph tab **without** running batch first

**Expected**: Empty state message prompting to run Batch Analysis first

---

## 5. Tab 4 — Temporal Analysis

### TC-12: SVG Bar Chart After Batch

**Pre-condition**: Batch Analysis run first  

**Expected**:
- SVG chart with 12 bars (one per month)
- **Teal segments** = Normal claims
- **Red segments** = Flagged claims
- Bars grow taller for months with more claims
- Month labels (J, F, M, A, M, J, J, A, S, O, N, D) aligned below each bar

---

### TC-13: Anomaly Spike Detection

**Expected**: Months with `flagRate > 20%` show:
- ⚠ yellow warning symbol above bar
- Amber alert banner at top: *"Anomaly Spikes Detected: [Month] (XX% flag rate)"*
- Row highlighted in monthly breakdown table with "⚠ spike" label

---

### TC-14: Monthly Breakdown Table

**Expected columns**: Month · Total · Flagged · Flag Rate · At-Risk ($)  
**Footer row**: Totals sum correctly across all months  
**Color coding**:
- Flag Rate > 20% → amber
- Flag Rate 10–20% → orange
- Flag Rate < 10% → emerald green

---

### TC-15: Empty State Without Batch Data

**Steps**: Fresh page load → click Temporal Analysis tab  

**Expected**:
- Clock icon
- Text: *"No Temporal Data Yet"*
- **"Generate Batch & View Timeline"** button (clicking runs batch automatically)

---

## 6. Tab 5 — AI Investigator

### TC-16: Search Box Renders

**Expected**:
- Input field with placeholder: *"e.g., Which providers have the highest fraud risk?"*
- **"Investigate"** button (disabled when input is empty)
- 4 quick-question chips below:
  1. Which providers have the highest fraud risk?
  2. Show me GLP-1 prescribing patterns
  3. Identify potential kickback schemes
  4. What are the top investigation priorities?

---

### TC-17: Quick Chip Populates Input

**Steps**: Click any quick-question chip  
**Expected**: Input field populated with question text; Investigate button becomes active

---

### TC-18: Structured AI Result (JSON Parsing)

**Steps**: Click **"Which providers have the highest fraud risk?"** → **"Investigate"**  
**Wait**: 2–3 seconds  

**Expected result cards** (NOT raw JSON text):

| Card | Content |
|------|---------|
| Status row | Risk badge (e.g., "HIGH RISK") + Action badge (e.g., "→ REVIEW") |
| Fraud Probability | Numeric % + colored progress bar (green/amber/red) |
| AI Reasoning | Prose explanation of fraud patterns detected |
| Clinical Evidence | Bulleted list of specific clinical red flags |
| Suggested Actions | Next investigation steps |

**❌ Failure**: If you see `{"riskLevel":"HIGH","fraudProbability":0.78,...}` as raw text → JSON parsing failed

---

### TC-19: Enter Key Submits Query

**Steps**: Type a question in input → press `Enter`  
**Expected**: Same behavior as clicking "Investigate"

---

### TC-20: Empty Query Blocked

**Steps**: Clear the input field → try to click "Investigate"  
**Expected**: Button remains disabled (`opacity-40`), no network call made

---

## 7. Settings — Amazon Nova API Integration

### TC-21: Rule-Based Mode (No API)

**Expected default** (no API configured):
- Header shows 🟡 **Rule-Based Mode** badge
- All analysis works with simulated AI responses
- No network requests to external APIs

---

### TC-22: API Endpoint Configuration

**Steps**: Click ⚙️ (settings gear icon) → enter API Gateway URL → save  

**Expected**:
- Mode badge changes to 🟢 **Nova AI Mode**
- Subsequent "Analyze Claim" requests send POST to your endpoint

**Test endpoint format**:
```
https://xxxx.execute-api.us-east-1.amazonaws.com/prod/invoke
```

**Expected POST body**:
```json
{
  "modelId": "amazon.nova-pro-v1:0",
  "messages": [{ "role": "user", "content": [{ "text": "..." }] }],
  "system": [{ "text": "You are a healthcare fraud investigator..." }],
  "inferenceConfig": { "maxTokens": 1024, "temperature": 0.3 }
}
```

---

## 8. Edge Cases & Regression Tests

### TC-23: Tab Switching Preserves State

**Steps**: Run batch → switch to Temporal → switch back to Batch  
**Expected**: Batch results still shown (state not lost on tab switch)

---

### TC-24: Rapid Tab Navigation

**Steps**: Quickly click through all 5 tabs repeatedly  
**Expected**: No crashes, no blank screens, no console errors

---

### TC-25: Window Resize / Responsive

**Steps**: Resize browser to 768px width  
**Expected**: Navigation tabs scroll or wrap; charts remain usable; no overflow clipping

---

### TC-26: Multiple Batch Runs

**Steps**: Run batch → run batch again  
**Expected**: Results reset and regenerate (not appended); counts are always ~500 claims

---

## 9. Quick Test Checklist

```
□  Page loads with dark theme (Tailwind CSS active)
□  Rule-Based Mode badge visible in header
□  TC-02: GLP-1 scenario → CRITICAL + BLOCK result card (not raw JSON)
□  TC-05: Normal Care scenario → LOW / Clean result
□  TC-07: Batch generates 500 claims, flags 55–80
□  TC-08: All 5 anomaly types appear in breakdown
□  TC-12: Temporal SVG chart renders bars (not blank)
□  TC-13: Anomaly spike ⚠ appears on high-flag-rate months
□  TC-18: AI Investigator shows structured cards (not raw JSON)
□  No console errors throughout entire flow
```

---

## 10. Development Build Test

```bash
npm run build        # Production bundle
npm run preview      # Preview at http://localhost:4173
```

**Expected**: Build completes with no errors; preview works identically to dev server

---

*RxHCC FWA Detection System · Testing Guide v1.0 · 2026-03-06*
