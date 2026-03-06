import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Shield, Search, Activity, Network, Clock, Bot, ChevronRight, Check, X, Loader2, Settings, Play, BarChart3, Users, DollarSign, FileText, Zap, Brain, TrendingUp } from 'lucide-react';

// ============================================================================
// CLINICAL RULE ENGINE - ICD-10, NDC, HCC Mappings
// ============================================================================

const ICD10_CODES = {
  'E11.9': { description: 'Type 2 Diabetes Mellitus without complications', hcc: 19, category: 'Diabetes' },
  'E11.65': { description: 'Type 2 DM with hyperglycemia', hcc: 18, category: 'Diabetes' },
  'E66.01': { description: 'Morbid obesity due to excess calories', hcc: 22, category: 'Obesity' },
  'E66.9': { description: 'Obesity, unspecified', hcc: 22, category: 'Obesity' },
  'I10': { description: 'Essential (primary) hypertension', hcc: null, category: 'Cardiovascular' },
  'I25.10': { description: 'Atherosclerotic heart disease', hcc: 88, category: 'Cardiovascular' },
  'J44.1': { description: 'COPD with acute exacerbation', hcc: 111, category: 'Respiratory' },
  'N18.6': { description: 'End stage renal disease', hcc: 137, category: 'Renal' },
  'F32.9': { description: 'Major depressive disorder', hcc: 59, category: 'Mental Health' },
  'C34.90': { description: 'Malignant neoplasm of lung', hcc: 9, category: 'Oncology' },
  'G20': { description: "Parkinson's disease", hcc: 78, category: 'Neurological' },
  'K70.30': { description: 'Alcoholic cirrhosis of liver', hcc: 28, category: 'Hepatic' },
};

const NDC_DRUGS = {
  '00169-4132-12': { name: 'Ozempic (Semaglutide) 1mg', class: 'GLP-1', indications: ['E11.9', 'E11.65', 'E66.01', 'E66.9'], avgCost: 936 },
  '00002-1023-80': { name: 'Mounjaro (Tirzepatide) 5mg', class: 'GLP-1/GIP', indications: ['E11.9', 'E11.65', 'E66.01'], avgCost: 1023 },
  '50090-2869-01': { name: 'Wegovy (Semaglutide) 2.4mg', class: 'GLP-1', indications: ['E66.01', 'E66.9'], avgCost: 1349 },
  '00006-3024-02': { name: 'Keytruda (Pembrolizumab)', class: 'Immunotherapy', indications: ['C34.90'], avgCost: 10897 },
  '00074-3799-02': { name: 'Humira (Adalimumab)', class: 'TNF Inhibitor', indications: ['M05.79', 'K50.90'], avgCost: 6922 },
  '61958-1801-01': { name: 'Eliquis (Apixaban)', class: 'Anticoagulant', indications: ['I48.91', 'I26.99'], avgCost: 521 },
  '00002-4462-01': { name: 'Trulicity (Dulaglutide)', class: 'GLP-1', indications: ['E11.9', 'E11.65'], avgCost: 886 },
  '00078-0640-15': { name: 'Entresto (Sacubitril/Valsartan)', class: 'ARNI', indications: ['I50.9', 'I50.22'], avgCost: 628 },
};

const HCC_RISK_SCORES = {
  9: { weight: 1.024, description: 'Lung, Upper Digestive Tract, and Other Severe Cancers' },
  18: { weight: 0.302, description: 'Diabetes with Chronic Complications' },
  19: { weight: 0.104, description: 'Diabetes without Complication' },
  22: { weight: 0.250, description: 'Morbid Obesity' },
  28: { weight: 0.363, description: 'Cirrhosis of Liver' },
  59: { weight: 0.309, description: 'Major Depressive, Bipolar Disorders' },
  78: { weight: 0.535, description: 'Parkinson Disease' },
  88: { weight: 0.140, description: 'Angina Pectoris' },
  111: { weight: 0.335, description: 'COPD' },
  137: { weight: 0.289, description: 'Chronic Kidney Disease, Stage 5' },
};

// ============================================================================
// FRAUD SCENARIOS
// ============================================================================

const FRAUD_SCENARIOS = [
  {
    id: 'glp1_offlabel',
    name: 'GLP-1 Off-Label Misuse',
    description: 'Ozempic prescribed for hypertension only - no diabetes or obesity diagnosis',
    claim: {
      claimId: 'CLM-2024-78432',
      patientId: 'PAT-10234',
      providerId: 'NPI-1234567890',
      providerName: 'Dr. John Smith',
      dateOfService: '2024-01-15',
      diagnoses: ['I10'],
      ndcCodes: ['00169-4132-12'],
      billedAmount: 936.00,
      placeOfService: 'Office',
    }
  },
  {
    id: 'hcc_upcoding',
    name: 'HCC Upcoding Scheme',
    description: 'Provider adding high-value HCC codes without supporting documentation',
    claim: {
      claimId: 'CLM-2024-89123',
      patientId: 'PAT-20456',
      providerId: 'NPI-9876543210',
      providerName: 'Dr. Sarah Johnson',
      dateOfService: '2024-02-20',
      diagnoses: ['E11.9', 'N18.6', 'J44.1', 'K70.30'],
      ndcCodes: [],
      billedAmount: 450.00,
      placeOfService: 'Office',
    }
  },
  {
    id: 'oncology_fraud',
    name: 'Oncology Drug Diversion',
    description: 'Expensive immunotherapy billed without cancer diagnosis',
    claim: {
      claimId: 'CLM-2024-56789',
      patientId: 'PAT-30789',
      providerId: 'NPI-5555555555',
      providerName: 'Dr. Michael Chen',
      dateOfService: '2024-03-10',
      diagnoses: ['I10', 'E11.9'],
      ndcCodes: ['00006-3024-02'],
      billedAmount: 10897.00,
      placeOfService: 'Outpatient Hospital',
    }
  },
  {
    id: 'normal_claim',
    name: 'Normal Diabetic Care',
    description: 'Legitimate GLP-1 prescription for Type 2 Diabetes patient',
    claim: {
      claimId: 'CLM-2024-11111',
      patientId: 'PAT-40123',
      providerId: 'NPI-1111111111',
      providerName: 'Dr. Emily Davis',
      dateOfService: '2024-01-25',
      diagnoses: ['E11.9', 'E66.01'],
      ndcCodes: ['00169-4132-12'],
      billedAmount: 936.00,
      placeOfService: 'Office',
    }
  },
  {
    id: 'duplicate_billing',
    name: 'Duplicate Billing Pattern',
    description: 'Same service billed multiple times across different dates',
    claim: {
      claimId: 'CLM-2024-22222',
      patientId: 'PAT-50234',
      providerId: 'NPI-2222222222',
      providerName: 'Dr. Robert Wilson',
      dateOfService: '2024-04-05',
      diagnoses: ['E11.65'],
      ndcCodes: ['00002-4462-01', '00002-4462-01'],
      billedAmount: 1772.00,
      placeOfService: 'Office',
    }
  }
];

// ============================================================================
// RULE ENGINE ANALYSIS
// ============================================================================

function analyzeClaimWithRules(claim) {
  const violations = [];
  let riskLevel = 'LOW';
  let totalRiskScore = 0;

  // Check NDC-Diagnosis matching
  claim.ndcCodes.forEach(ndc => {
    const drug = NDC_DRUGS[ndc];
    if (drug) {
      const hasValidIndication = drug.indications.some(ind => claim.diagnoses.includes(ind));
      if (!hasValidIndication) {
        violations.push({
          type: 'NDC_DIAGNOSIS_MISMATCH',
          severity: 'CRITICAL',
          description: `${drug.name} prescribed without valid indication. Required: ${drug.indications.map(i => ICD10_CODES[i]?.description || i).join(', ')}`,
          drugClass: drug.class,
          cost: drug.avgCost
        });
        totalRiskScore += 40;
      }
    }
  });

  // Check for duplicate NDC codes
  const ndcCounts = {};
  claim.ndcCodes.forEach(ndc => {
    ndcCounts[ndc] = (ndcCounts[ndc] || 0) + 1;
    if (ndcCounts[ndc] > 1) {
      violations.push({
        type: 'DUPLICATE_NDC',
        severity: 'HIGH',
        description: `Duplicate billing detected for NDC ${ndc}`,
        count: ndcCounts[ndc]
      });
      totalRiskScore += 25;
    }
  });

  // Check HCC risk score validity
  let hccTotal = 0;
  const hccCodes = [];
  claim.diagnoses.forEach(icd => {
    const icdInfo = ICD10_CODES[icd];
    if (icdInfo && icdInfo.hcc) {
      const hccInfo = HCC_RISK_SCORES[icdInfo.hcc];
      if (hccInfo) {
        hccTotal += hccInfo.weight;
        hccCodes.push({ hcc: icdInfo.hcc, weight: hccInfo.weight, description: hccInfo.description });
      }
    }
  });

  // Flag suspicious HCC accumulation
  if (hccTotal > 1.5) {
    violations.push({
      type: 'HCC_UPCODING_SUSPECT',
      severity: 'HIGH',
      description: `Unusually high HCC risk score accumulation: ${hccTotal.toFixed(3)}`,
      hccCodes
    });
    totalRiskScore += 30;
  }

  // Check for high-cost drug without proper documentation
  claim.ndcCodes.forEach(ndc => {
    const drug = NDC_DRUGS[ndc];
    if (drug && drug.avgCost > 5000 && claim.diagnoses.length < 2) {
      violations.push({
        type: 'HIGH_COST_INADEQUATE_DOCUMENTATION',
        severity: 'MEDIUM',
        description: `High-cost drug ($${drug.avgCost}) with minimal diagnostic support`,
        drug: drug.name
      });
      totalRiskScore += 15;
    }
  });

  // Determine overall risk level
  if (totalRiskScore >= 40) riskLevel = 'CRITICAL';
  else if (totalRiskScore >= 25) riskLevel = 'HIGH';
  else if (totalRiskScore >= 10) riskLevel = 'MEDIUM';

  return {
    violations,
    riskLevel,
    riskScore: totalRiskScore,
    hccTotal,
    hccCodes,
    isClean: violations.length === 0
  };
}

// ============================================================================
// BATCH CLAIM GENERATOR
// ============================================================================

function generateSyntheticClaims(count = 500) {
  const claims = [];
  const providers = [
    { id: 'NPI-1001', name: 'Dr. Anderson', specialty: 'Internal Medicine' },
    { id: 'NPI-1002', name: 'Dr. Baker', specialty: 'Endocrinology' },
    { id: 'NPI-1003', name: 'Dr. Clark', specialty: 'Cardiology' },
    { id: 'NPI-1004', name: 'Dr. Davis', specialty: 'Family Medicine' },
    { id: 'NPI-1005', name: 'Dr. Evans', specialty: 'Oncology' },
    { id: 'NPI-1006', name: 'Dr. Foster', specialty: 'Nephrology' },
    { id: 'NPI-1007', name: 'Dr. Garcia', specialty: 'Pulmonology' },
    { id: 'NPI-1008', name: 'Dr. Harris', specialty: 'Psychiatry' },
  ];

  const anomalyTypes = ['glp1_offlabel', 'hcc_upcoding', 'duplicate', 'high_cost', 'doctor_shopping'];
  const ndcKeys = Object.keys(NDC_DRUGS);
  const icdKeys = Object.keys(ICD10_CODES);

  for (let i = 0; i < count; i++) {
    const isAnomaly = Math.random() < 0.15; // 15% anomaly rate
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const baseDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

    let claim = {
      claimId: `CLM-2024-${String(i + 1).padStart(5, '0')}`,
      patientId: `PAT-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`,
      providerId: provider.id,
      providerName: provider.name,
      specialty: provider.specialty,
      dateOfService: baseDate.toISOString().split('T')[0],
      diagnoses: [],
      ndcCodes: [],
      billedAmount: 0,
      placeOfService: Math.random() > 0.3 ? 'Office' : 'Outpatient Hospital',
      isPlantedAnomaly: false,
      anomalyType: null
    };

    if (isAnomaly) {
      const anomalyType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
      claim.isPlantedAnomaly = true;
      claim.anomalyType = anomalyType;

      switch (anomalyType) {
        case 'glp1_offlabel':
          claim.diagnoses = ['I10'];
          claim.ndcCodes = ['00169-4132-12'];
          claim.billedAmount = 936;
          break;
        case 'hcc_upcoding':
          claim.diagnoses = ['E11.9', 'N18.6', 'J44.1', 'K70.30'];
          claim.billedAmount = 450;
          break;
        case 'duplicate':
          claim.diagnoses = ['E11.65'];
          claim.ndcCodes = ['00002-4462-01', '00002-4462-01'];
          claim.billedAmount = 1772;
          break;
        case 'high_cost':
          claim.diagnoses = ['I10'];
          claim.ndcCodes = ['00006-3024-02'];
          claim.billedAmount = 10897;
          break;
        case 'doctor_shopping':
          claim.patientId = 'PAT-SHOP-001'; // Same patient across providers
          claim.diagnoses = ['F32.9'];
          claim.ndcCodes = [];
          claim.billedAmount = 250;
          break;
      }
    } else {
      // Normal claim
      const numDiagnoses = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numDiagnoses; j++) {
        const icd = icdKeys[Math.floor(Math.random() * icdKeys.length)];
        if (!claim.diagnoses.includes(icd)) claim.diagnoses.push(icd);
      }

      if (Math.random() > 0.6) {
        const ndc = ndcKeys[Math.floor(Math.random() * ndcKeys.length)];
        const drug = NDC_DRUGS[ndc];
        // Ensure proper indication for normal claims
        if (drug.indications.some(ind => claim.diagnoses.includes(ind))) {
          claim.ndcCodes.push(ndc);
          claim.billedAmount = drug.avgCost;
        }
      }

      if (claim.billedAmount === 0) {
        claim.billedAmount = Math.floor(Math.random() * 500) + 50;
      }
    }

    claims.push(claim);
  }

  return claims;
}

// ============================================================================
// NETWORK ANALYSIS
// ============================================================================

function analyzeProviderNetwork(claims) {
  const providerPatients = {};
  const providerViolations = {};
  const patientProviders = {};

  claims.forEach(claim => {
    const analysis = analyzeClaimWithRules(claim);

    if (!providerPatients[claim.providerId]) {
      providerPatients[claim.providerId] = new Set();
      providerViolations[claim.providerId] = { count: 0, amount: 0, name: claim.providerName };
    }
    providerPatients[claim.providerId].add(claim.patientId);

    if (!patientProviders[claim.patientId]) {
      patientProviders[claim.patientId] = new Set();
    }
    patientProviders[claim.patientId].add(claim.providerId);

    if (!analysis.isClean) {
      providerViolations[claim.providerId].count += analysis.violations.length;
      providerViolations[claim.providerId].amount += claim.billedAmount;
    }
  });

  // Find provider connections (shared patients)
  const connections = [];
  const providerIds = Object.keys(providerPatients);

  for (let i = 0; i < providerIds.length; i++) {
    for (let j = i + 1; j < providerIds.length; j++) {
      const p1 = providerIds[i];
      const p2 = providerIds[j];
      const shared = [...providerPatients[p1]].filter(p => providerPatients[p2].has(p));

      if (shared.length > 0) {
        const combinedViolationRate = (providerViolations[p1].count + providerViolations[p2].count) /
          (providerPatients[p1].size + providerPatients[p2].size);

        connections.push({
          provider1: p1,
          provider2: p2,
          provider1Name: providerViolations[p1].name,
          provider2Name: providerViolations[p2].name,
          sharedPatients: shared.length,
          combinedViolationRate,
          suspicious: combinedViolationRate > 0.3 && shared.length > 2
        });
      }
    }
  }

  // Find doctor shopping patients
  const doctorShoppers = Object.entries(patientProviders)
    .filter(([_, providers]) => providers.size >= 3)
    .map(([patientId, providers]) => ({
      patientId,
      providerCount: providers.size,
      providers: [...providers]
    }));

  // Hub providers (high connection count)
  const hubProviders = providerIds
    .map(id => ({
      providerId: id,
      name: providerViolations[id].name,
      patientCount: providerPatients[id].size,
      violationCount: providerViolations[id].count,
      atRiskAmount: providerViolations[id].amount
    }))
    .filter(p => p.patientCount > 5 || p.violationCount > 3)
    .sort((a, b) => b.violationCount - a.violationCount);

  return {
    connections: connections.sort((a, b) => b.sharedPatients - a.sharedPatients),
    doctorShoppers,
    hubProviders,
    suspiciousConnections: connections.filter(c => c.suspicious)
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RxHCCFraudDetection() {
  const [activeTab, setActiveTab] = useState('single');
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Batch analysis state
  const [batchClaims, setBatchClaims] = useState([]);
  const [batchResults, setBatchResults] = useState(null);
  const [batchAiInsights, setBatchAiInsights] = useState(null);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

  // Network analysis state
  const [networkAnalysis, setNetworkAnalysis] = useState(null);

  // AI Investigator state
  const [investigatorQuery, setInvestigatorQuery] = useState('');
  const [investigatorResponse, setInvestigatorResponse] = useState(null);
  const [isInvestigating, setIsInvestigating] = useState(false);

  // Amazon Nova API call
  const callNovaAPI = async (prompt, systemPrompt = '') => {
    if (!apiEndpoint) {
      // Fallback: Return simulated AI response
      return simulateAIResponse(prompt);
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'amazon.nova-pro-v1:0',
          messages: [
            { role: 'user', content: prompt }
          ],
          system: [{ text: systemPrompt || 'You are a healthcare fraud investigator AI assistant.' }],
          inferenceConfig: {
            maxTokens: 1024,
            temperature: 0.3
          }
        })
      });

      const data = await response.json();
      return data.output?.message?.content?.[0]?.text || data.content || JSON.stringify(data);
    } catch (error) {
      console.error('Nova API Error:', error);
      return simulateAIResponse(prompt);
    }
  };

  // Simulated AI response for demo mode
  const simulateAIResponse = (prompt) => {
    if (prompt.includes('GLP-1') || prompt.includes('Ozempic') || prompt.includes('off-label')) {
      return JSON.stringify({
        riskLevel: 'HIGH',
        fraudProbability: 0.85,
        recommendedAction: 'BLOCK',
        reasoning: 'Semaglutide (Ozempic) is FDA-approved only for Type 2 Diabetes Mellitus and obesity management. Prescribing for essential hypertension (I10) alone has no clinical justification and represents potential off-label fraud for cosmetic weight loss or drug diversion.',
        clinicalEvidence: [
          'No diabetes diagnosis (E11.x) present',
          'No obesity diagnosis (E66.x) present',
          'Drug cost ($936) significantly above typical hypertension medications',
          'GLP-1 agonists have no approved cardiovascular indication for hypertension alone'
        ],
        suggestedInvestigation: 'Review provider prescribing patterns for GLP-1 medications. Check patient history for weight loss clinic visits or prior obesity documentation.'
      });
    } else if (prompt.includes('HCC') || prompt.includes('upcoding')) {
      return JSON.stringify({
        riskLevel: 'HIGH',
        fraudProbability: 0.78,
        recommendedAction: 'REVIEW',
        reasoning: 'Multiple high-value HCC codes submitted for a single encounter suggests potential risk adjustment fraud. The combination of ESRD, COPD, and cirrhosis in one visit requires supporting documentation.',
        clinicalEvidence: [
          'Combined HCC risk score exceeds 1.5',
          'Four major chronic conditions documented in single visit',
          'Pattern consistent with annual wellness visit upcoding'
        ],
        suggestedInvestigation: 'Request medical records for visit. Compare with prior year diagnoses. Check provider HCC submission patterns.'
      });
    } else if (prompt.includes('Keytruda') || prompt.includes('oncology') || prompt.includes('immunotherapy')) {
      return JSON.stringify({
        riskLevel: 'CRITICAL',
        fraudProbability: 0.92,
        recommendedAction: 'BLOCK',
        reasoning: 'Pembrolizumab (Keytruda) is an expensive immunotherapy agent ($10,897) indicated only for specific cancer types. Billing without any cancer diagnosis (C-codes) indicates potential drug diversion or billing fraud.',
        clinicalEvidence: [
          'No oncology diagnosis present',
          'Drug cost exceeds $10,000 per administration',
          'Immunotherapy without cancer diagnosis has no clinical basis'
        ],
        suggestedInvestigation: 'Immediate review required. Verify drug administration records. Check if drug was actually dispensed to patient.'
      });
    }

    return JSON.stringify({
      riskLevel: 'LOW',
      fraudProbability: 0.12,
      recommendedAction: 'APPROVE',
      reasoning: 'Claim appears clinically appropriate. Diagnoses support prescribed medications and billed services.',
      clinicalEvidence: ['Appropriate diagnosis-drug matching', 'Normal billing patterns'],
      suggestedInvestigation: 'None required - routine claim.'
    });
  };

  // Single claim analysis
  const analyzeSingleClaim = async () => {
    if (!selectedScenario) return;

    setIsAnalyzing(true);
    setAiAnalysis(null);

    const ruleResult = analyzeClaimWithRules(selectedScenario.claim);
    setAnalysisResult(ruleResult);

    // Prepare prompt for AI
    const prompt = `Analyze this healthcare claim for fraud indicators:

Claim ID: ${selectedScenario.claim.claimId}
Provider: ${selectedScenario.claim.providerName} (${selectedScenario.claim.providerId})
Date: ${selectedScenario.claim.dateOfService}
Diagnoses: ${selectedScenario.claim.diagnoses.map(d => `${d} - ${ICD10_CODES[d]?.description || 'Unknown'}`).join('; ')}
Medications (NDC): ${selectedScenario.claim.ndcCodes.map(n => `${n} - ${NDC_DRUGS[n]?.name || 'Unknown'}`).join('; ')}
Billed Amount: $${selectedScenario.claim.billedAmount.toFixed(2)}

Rule Engine Findings:
${ruleResult.violations.map(v => `- ${v.type}: ${v.description}`).join('\n')}
Risk Score: ${ruleResult.riskScore}

Provide your analysis as JSON with: riskLevel, fraudProbability, recommendedAction, reasoning, clinicalEvidence (array), suggestedInvestigation`;

    try {
      const response = await callNovaAPI(prompt, 'You are an expert healthcare fraud investigator. Analyze claims for FWA indicators.');
      const parsed = JSON.parse(response);
      setAiAnalysis(parsed);
    } catch (e) {
      setAiAnalysis({ error: 'Failed to parse AI response', raw: e.message });
    }

    setIsAnalyzing(false);
  };

  // Batch analysis
  const runBatchAnalysis = async () => {
    setIsBatchAnalyzing(true);
    setBatchAiInsights(null);

    const claims = generateSyntheticClaims(500);
    setBatchClaims(claims);

    let flaggedClaims = [];
    let totalAtRisk = 0;
    const anomalyBreakdown = {};

    claims.forEach(claim => {
      const result = analyzeClaimWithRules(claim);
      if (!result.isClean) {
        flaggedClaims.push({ claim, result });
        totalAtRisk += claim.billedAmount;

        result.violations.forEach(v => {
          anomalyBreakdown[v.type] = (anomalyBreakdown[v.type] || 0) + 1;
        });
      }
    });

    // Network analysis
    const network = analyzeProviderNetwork(claims);
    setNetworkAnalysis(network);

    setBatchResults({
      totalClaims: claims.length,
      flaggedCount: flaggedClaims.length,
      totalAtRisk,
      anomalyBreakdown,
      flaggedClaims: flaggedClaims.slice(0, 20), // Top 20 for display
      flagRate: ((flaggedClaims.length / claims.length) * 100).toFixed(1)
    });

    // Get AI insights on batch
    const batchPrompt = `Analyze this batch of healthcare claims for patterns:

Total Claims: ${claims.length}
Flagged Claims: ${flaggedClaims.length}
Total At-Risk Amount: $${totalAtRisk.toFixed(2)}
Anomaly Types Found: ${Object.entries(anomalyBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}

Provider Network Analysis:
- Hub Providers (high volume): ${network.hubProviders.length}
- Suspicious Provider Connections: ${network.suspiciousConnections.length}
- Potential Doctor Shopping Patients: ${network.doctorShoppers.length}

Provide insights on: cross-claim patterns, provider network concerns, temporal anomalies, and priority investigation targets.`;

    try {
      const response = await callNovaAPI(batchPrompt, 'You are a healthcare fraud analytics expert analyzing batch claims data.');
      setBatchAiInsights(response);
    } catch (e) {
      setBatchAiInsights('AI analysis unavailable in demo mode. Enable Amazon Nova endpoint for full analysis.');
    }

    setIsBatchAnalyzing(false);
  };

  // AI Investigator
  const askInvestigator = async () => {
    if (!investigatorQuery.trim()) return;

    setIsInvestigating(true);

    const contextPrompt = `Based on the analyzed healthcare claims data:
${batchResults ? `
- ${batchResults.totalClaims} total claims analyzed
- ${batchResults.flaggedCount} flagged for review
- $${batchResults.totalAtRisk?.toFixed(2)} total at-risk amount
- Top anomalies: ${Object.entries(batchResults.anomalyBreakdown || {}).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(', ')}
` : 'No batch analysis performed yet.'}

${networkAnalysis ? `
Provider Network:
- ${networkAnalysis.hubProviders?.length} hub providers identified
- ${networkAnalysis.suspiciousConnections?.length} suspicious provider connections
- ${networkAnalysis.doctorShoppers?.length} potential doctor shopping patients
` : ''}

User Question: ${investigatorQuery}

Provide a detailed, actionable response as a fraud investigator.`;

    try {
      const response = await callNovaAPI(contextPrompt, 'You are an AI-powered SIU (Special Investigations Unit) analyst assistant.');
      setInvestigatorResponse(response);
    } catch (e) {
      setInvestigatorResponse('Unable to process query. Please try again.');
    }

    setIsInvestigating(false);
  };

  // Risk level colors
  const getRiskColor = (level) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-400';
      case 'HIGH': return 'text-orange-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-emerald-400';
      default: return 'text-slate-400';
    }
  };

  const getRiskBg = (level) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500/20 border-red-500/40';
      case 'HIGH': return 'bg-orange-500/20 border-orange-500/40';
      case 'MEDIUM': return 'bg-yellow-500/20 border-yellow-500/40';
      case 'LOW': return 'bg-emerald-500/20 border-emerald-500/40';
      default: return 'bg-slate-500/20 border-slate-500/40';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Shield className="w-10 h-10 text-cyan-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">RxHCC</span>
                  <span className="text-slate-300 ml-2">Fraud Detection</span>
                </h1>
                <p className="text-sm text-slate-500">Healthcare FWA Detection System • Powered by Amazon Nova</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${apiEndpoint ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                <div className={`w-2 h-2 rounded-full ${apiEndpoint ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                {apiEndpoint ? 'Nova API Connected' : 'Rule-Based Mode'}
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              >
                <Settings className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="relative border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <label className="text-sm text-slate-400">Amazon Nova API Endpoint:</label>
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://your-api-gateway.execute-api.region.amazonaws.com/prod/invoke"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Deploy an API Gateway + Lambda proxy to Amazon Bedrock. Without an endpoint, the system operates in rule-based mode with simulated AI responses.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="relative border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'single', label: 'Single Claim', icon: FileText },
              { id: 'batch', label: 'Batch Analysis', icon: BarChart3 },
              { id: 'network', label: 'Network Graph', icon: Network },
              { id: 'temporal', label: 'Temporal Analysis', icon: Clock },
              { id: 'investigator', label: 'AI Investigator', icon: Bot },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id
                  ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 py-8">

        {/* Single Claim Analysis */}
        {activeTab === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scenario Selector */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Select Scenario
              </h2>
              <div className="space-y-3">
                {FRAUD_SCENARIOS.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setSelectedScenario(scenario);
                      setAnalysisResult(null);
                      setAiAnalysis(null);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedScenario?.id === scenario.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/20'
                      : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600/50'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-200">{scenario.name}</h3>
                        <p className="text-sm text-slate-400 mt-1">{scenario.description}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform ${selectedScenario?.id === scenario.id ? 'text-cyan-400 rotate-90' : 'text-slate-500'}`} />
                    </div>
                  </button>
                ))}
              </div>

              {selectedScenario && (
                <button
                  onClick={analyzeSingleClaim}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Analyze Claim
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Analysis Results */}
            <div className="lg:col-span-2 space-y-6">
              {selectedScenario && (
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Claim Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Claim ID:</span>
                      <span className="ml-2 text-slate-200 font-mono">{selectedScenario.claim.claimId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Provider:</span>
                      <span className="ml-2 text-slate-200">{selectedScenario.claim.providerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Date:</span>
                      <span className="ml-2 text-slate-200">{selectedScenario.claim.dateOfService}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Amount:</span>
                      <span className="ml-2 text-emerald-400 font-semibold">${selectedScenario.claim.billedAmount.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Diagnoses:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {selectedScenario.claim.diagnoses.map(d => (
                          <span key={d} className="px-2 py-1 rounded-lg bg-slate-700/50 text-xs font-mono text-slate-300">
                            {d} - {ICD10_CODES[d]?.description || 'Unknown'}
                          </span>
                        ))}
                      </div>
                    </div>
                    {selectedScenario.claim.ndcCodes.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Medications (NDC):</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {selectedScenario.claim.ndcCodes.map((n, i) => (
                            <span key={i} className="px-2 py-1 rounded-lg bg-violet-500/20 text-xs font-mono text-violet-300">
                              {NDC_DRUGS[n]?.name || n}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rule Engine Results */}
              {analysisResult && (
                <div className={`p-6 rounded-2xl border ${getRiskBg(analysisResult.riskLevel)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${getRiskColor(analysisResult.riskLevel)}`} />
                      Rule Engine Analysis
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskColor(analysisResult.riskLevel)}`}>
                      {analysisResult.riskLevel}
                    </span>
                  </div>

                  {analysisResult.violations.length > 0 ? (
                    <div className="space-y-3">
                      {analysisResult.violations.map((v, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-900/50">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-mono ${v.severity === 'CRITICAL' ? 'bg-red-500/30 text-red-300' :
                              v.severity === 'HIGH' ? 'bg-orange-500/30 text-orange-300' :
                                'bg-yellow-500/30 text-yellow-300'
                              }`}>
                              {v.type}
                            </span>
                            <span className="text-xs text-slate-500">{v.severity}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{v.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Check className="w-5 h-5" />
                      <span>No violations detected - claim appears clean</span>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis Results */}
              {aiAnalysis && !aiAnalysis.error && (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-violet-400" />
                      Amazon Nova AI Analysis
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskColor(aiAnalysis.riskLevel)}`}>
                        {aiAnalysis.riskLevel}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm bg-slate-700/50 text-slate-300">
                        {(aiAnalysis.fraudProbability * 100).toFixed(0)}% Fraud Probability
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-1">Recommended Action</h4>
                      <span className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-sm ${aiAnalysis.recommendedAction === 'BLOCK' ? 'bg-red-500/20 text-red-400' :
                        aiAnalysis.recommendedAction === 'REVIEW' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                        {aiAnalysis.recommendedAction}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-1">Medical Reasoning</h4>
                      <p className="text-slate-200">{aiAnalysis.reasoning}</p>
                    </div>

                    {aiAnalysis.clinicalEvidence && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-2">Clinical Evidence</h4>
                        <ul className="space-y-1">
                          {aiAnalysis.clinicalEvidence.map((e, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="text-cyan-400 mt-0.5">•</span>
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiAnalysis.suggestedInvestigation && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-1">Suggested Investigation</h4>
                        <p className="text-slate-300 text-sm">{aiAnalysis.suggestedInvestigation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch Analysis */}
        {activeTab === 'batch' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-200">Batch Claim Analysis</h2>
                <p className="text-slate-400 mt-1">Generate and analyze 500 synthetic claims with planted anomalies</p>
              </div>
              <button
                onClick={runBatchAnalysis}
                disabled={isBatchAnalyzing}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isBatchAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing 500 Claims...
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5" />
                    Generate & Analyze Batch
                  </>
                )}
              </button>
            </div>

            {batchResults && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-cyan-500/20">
                        <FileText className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-100">{batchResults.totalClaims}</p>
                        <p className="text-sm text-slate-400">Total Claims</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-red-500/20">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-100">{batchResults.flaggedCount}</p>
                        <p className="text-sm text-slate-400">Flagged ({batchResults.flagRate}%)</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-amber-500/20">
                        <DollarSign className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-100">${batchResults.totalAtRisk.toLocaleString()}</p>
                        <p className="text-sm text-slate-400">At-Risk Amount</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-violet-500/20">
                        <Users className="w-6 h-6 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-100">{networkAnalysis?.hubProviders?.length || 0}</p>
                        <p className="text-sm text-slate-400">Flagged Providers</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Anomaly Breakdown */}
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Anomaly Type Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(batchResults.anomalyBreakdown).map(([type, count]) => (
                      <div key={type} className="p-4 rounded-xl bg-slate-900/50">
                        <p className="text-xs font-mono text-slate-400 mb-1">{type}</p>
                        <p className="text-2xl font-bold text-slate-200">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flagged Claims Table */}
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Top Flagged Claims</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-700/50">
                          <th className="pb-3 pr-4">Claim ID</th>
                          <th className="pb-3 pr-4">Provider</th>
                          <th className="pb-3 pr-4">Amount</th>
                          <th className="pb-3 pr-4">Risk</th>
                          <th className="pb-3">Violations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResults.flaggedClaims.map(({ claim, result }) => (
                          <tr key={claim.claimId} className="border-b border-slate-800/50">
                            <td className="py-3 pr-4 font-mono text-slate-300">{claim.claimId}</td>
                            <td className="py-3 pr-4 text-slate-300">{claim.providerName}</td>
                            <td className="py-3 pr-4 text-emerald-400">${claim.billedAmount.toFixed(2)}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(result.riskLevel)}`}>
                                {result.riskLevel}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {result.violations.slice(0, 2).map((v, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400">
                                    {v.type}
                                  </span>
                                ))}
                                {result.violations.length > 2 && (
                                  <span className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-500">
                                    +{result.violations.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI Batch Insights */}
                {batchAiInsights && (
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/30">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-violet-400" />
                      AI Pattern Analysis
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-slate-300 text-sm font-sans leading-relaxed">{batchAiInsights}</pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Network Graph */}
        {activeTab === 'network' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-200">Provider Network Analysis</h2>
              <p className="text-slate-400 mt-1">Identify suspicious provider relationships and patient sharing patterns</p>
            </div>

            {networkAnalysis ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hub Providers */}
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    High-Volume Providers
                  </h3>
                  <div className="space-y-3">
                    {networkAnalysis.hubProviders.map((p, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-900/50 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-200">{p.name}</p>
                          <p className="text-sm text-slate-400 font-mono">{p.providerId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-slate-400">Patients:</span>
                            <span className="ml-2 text-cyan-400 font-semibold">{p.patientCount}</span>
                          </p>
                          <p className="text-sm">
                            <span className="text-slate-400">Violations:</span>
                            <span className={`ml-2 font-semibold ${p.violationCount > 5 ? 'text-red-400' : 'text-amber-400'}`}>{p.violationCount}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suspicious Connections */}
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <Network className="w-5 h-5 text-orange-400" />
                    Suspicious Provider Connections
                  </h3>
                  {networkAnalysis.suspiciousConnections.length > 0 ? (
                    <div className="space-y-3">
                      {networkAnalysis.suspiciousConnections.map((c, i) => (
                        <div key={i} className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-slate-200">{c.provider1Name}</span>
                            <span className="text-orange-400">↔</span>
                            <span className="text-slate-200">{c.provider2Name}</span>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span className="text-slate-400">
                              Shared Patients: <span className="text-orange-400 font-semibold">{c.sharedPatients}</span>
                            </span>
                            <span className="text-slate-400">
                              Combined Violation Rate: <span className="text-red-400 font-semibold">{(c.combinedViolationRate * 100).toFixed(1)}%</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No suspicious connections detected</p>
                  )}
                </div>

                {/* Doctor Shopping */}
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    Potential Doctor Shopping
                  </h3>
                  {networkAnalysis.doctorShoppers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {networkAnalysis.doctorShoppers.map((p, i) => (
                        <div key={i} className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                          <p className="font-mono text-slate-200">{p.patientId}</p>
                          <p className="text-sm text-slate-400 mt-1">
                            Visited <span className="text-red-400 font-semibold">{p.providerCount}</span> providers
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No doctor shopping patterns detected</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Network className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Run a batch analysis first to generate network data</p>
              </div>
            )}
          </div>
        )}

        {/* Temporal Analysis */}
        {activeTab === 'temporal' && (() => {
          // Compute monthly stats from batchClaims OR demo data
          const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const MONTH_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

          const sourceData = batchClaims.length > 0 ? batchClaims : [];
          const monthStats = Array.from({ length: 12 }, (_, m) => {
            const mc = sourceData.filter(c => new Date(c.dateOfService).getMonth() === m);
            const flagged = mc.filter(c => !analyzeClaimWithRules(c).isClean).length;
            const atRisk = mc.filter(c => !analyzeClaimWithRules(c).isClean)
              .reduce((s, c) => s + c.billedAmount, 0);
            return {
              month: m, label: MONTH_LABELS[m], short: MONTH_SHORT[m],
              total: mc.length, flagged, normal: mc.length - flagged,
              atRisk, flagRate: mc.length > 0 ? (flagged / mc.length * 100) : 0
            };
          });

          const maxTotal = Math.max(...monthStats.map(s => s.total), 1);
          const CHART_H = 180;   // px
          const BAR_W = 32;    // px
          const CHART_W = 12 * (BAR_W + 8) + 8;

          // Anomaly spikes: months where flagRate > 20%
          const spikes = monthStats.filter(s => s.total > 0 && s.flagRate > 20);

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-200">Temporal Pattern Analysis</h2>
                  <p className="text-slate-400 mt-1">Detect billing spikes and seasonal anomalies</p>
                </div>
                {batchClaims.length === 0 && (
                  <button
                    onClick={runBatchAnalysis}
                    disabled={isBatchAnalyzing}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isBatchAnalyzing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                    ) : (
                      <><Activity className="w-4 h-4" />Run Batch Analysis</>
                    )}
                  </button>
                )}
              </div>

              {batchClaims.length > 0 ? (
                <>
                  {/* Spike Alerts */}
                  {spikes.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-300">Anomaly Spikes Detected</p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {spikes.map(s => `${s.label} (${s.flagRate.toFixed(1)}% flag rate)`).join(' · ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SVG Bar Chart */}
                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />
                      Monthly Claim Distribution
                    </h3>

                    <div className="overflow-x-auto">
                      <svg
                        width={CHART_W}
                        height={CHART_H + 48}
                        className="min-w-full"
                        style={{ minWidth: CHART_W }}
                      >
                        {/* Y-axis grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                          const y = CHART_H - pct * CHART_H;
                          return (
                            <g key={pct}>
                              <line x1={0} y1={y} x2={CHART_W} y2={y}
                                stroke="#334155" strokeWidth={1} strokeDasharray="4 4" />
                              <text x={0} y={y - 4} fill="#64748b" fontSize={10}>
                                {Math.round(pct * maxTotal)}
                              </text>
                            </g>
                          );
                        })}

                        {monthStats.map((s, i) => {
                          const x = 8 + i * (BAR_W + 8);
                          const totalH = s.total > 0 ? (s.total / maxTotal) * CHART_H : 0;
                          const flagH = s.flagged > 0 ? (s.flagged / maxTotal) * CHART_H : 0;
                          const normalH = totalH - flagH;
                          const isSpike = s.total > 0 && s.flagRate > 20;

                          return (
                            <g key={i}>
                              {/* Normal claims (blue) */}
                              {normalH > 0 && (
                                <rect
                                  x={x} y={CHART_H - totalH}
                                  width={BAR_W} height={normalH}
                                  rx={3} fill="rgba(34,211,238,0.35)"
                                />
                              )}
                              {/* Flagged claims (red) stacked on top */}
                              {flagH > 0 && (
                                <rect
                                  x={x} y={CHART_H - flagH}
                                  width={BAR_W} height={flagH}
                                  rx={3} fill="rgba(239,68,68,0.6)"
                                />
                              )}
                              {/* Spike indicator */}
                              {isSpike && (
                                <text x={x + BAR_W / 2} y={CHART_H - totalH - 6}
                                  textAnchor="middle" fill="#fbbf24" fontSize={11} fontWeight="bold">
                                  ⚠
                                </text>
                              )}
                              {/* Month label */}
                              <text x={x + BAR_W / 2} y={CHART_H + 18}
                                textAnchor="middle" fill="#94a3b8" fontSize={11}>
                                {s.short}
                              </text>
                              {/* Total count above bar */}
                              {s.total > 0 && (
                                <text x={x + BAR_W / 2} y={CHART_H - totalH - (isSpike ? 18 : 4)}
                                  textAnchor="middle" fill="#cbd5e1" fontSize={9}>
                                  {s.total}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {/* X-axis baseline */}
                        <line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H}
                          stroke="#475569" strokeWidth={1} />
                      </svg>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mt-4 justify-center">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded" style={{ background: 'rgba(34,211,238,0.35)' }} />
                        <span className="text-sm text-slate-400">Normal Claims</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded" style={{ background: 'rgba(239,68,68,0.6)' }} />
                        <span className="text-sm text-slate-400">Flagged Claims</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-sm">⚠</span>
                        <span className="text-sm text-slate-400">Anomaly Spike (&gt;20% flag rate)</span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Stats Table */}
                  <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-violet-400" />
                      Monthly Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400 border-b border-slate-700/50">
                            <th className="pb-3 pr-6">Month</th>
                            <th className="pb-3 pr-6 text-right">Total</th>
                            <th className="pb-3 pr-6 text-right">Flagged</th>
                            <th className="pb-3 pr-6 text-right">Flag Rate</th>
                            <th className="pb-3 text-right">At-Risk ($)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthStats.filter(s => s.total > 0).map(s => (
                            <tr key={s.month}
                              className={`border-b border-slate-800/50 ${s.flagRate > 20 ? 'bg-amber-500/5' : ''}`}>
                              <td className="py-2.5 pr-6 font-medium text-slate-200">
                                {s.label}
                                {s.flagRate > 20 && (
                                  <span className="ml-2 text-xs text-amber-400">⚠ spike</span>
                                )}
                              </td>
                              <td className="py-2.5 pr-6 text-right text-slate-300">{s.total}</td>
                              <td className="py-2.5 pr-6 text-right text-red-400">{s.flagged}</td>
                              <td className="py-2.5 pr-6 text-right">
                                <span className={`font-semibold ${s.flagRate > 20 ? 'text-amber-400' :
                                  s.flagRate > 10 ? 'text-orange-400' : 'text-emerald-400'
                                  }`}>
                                  {s.flagRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-slate-300">
                                ${s.atRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-600/50 font-semibold">
                            <td className="pt-3 pr-6 text-slate-300">Total</td>
                            <td className="pt-3 pr-6 text-right text-slate-200">
                              {monthStats.reduce((a, s) => a + s.total, 0)}
                            </td>
                            <td className="pt-3 pr-6 text-right text-red-400">
                              {monthStats.reduce((a, s) => a + s.flagged, 0)}
                            </td>
                            <td className="pt-3 pr-6 text-right text-slate-300">
                              {(monthStats.reduce((a, s) => a + s.flagged, 0) /
                                Math.max(monthStats.reduce((a, s) => a + s.total, 0), 1) * 100).toFixed(1)}%
                            </td>
                            <td className="pt-3 text-right text-amber-400">
                              ${monthStats.reduce((a, s) => a + s.atRisk, 0)
                                .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-20 space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-2xl scale-150" />
                    <div className="relative p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                      <Clock className="w-16 h-16 text-slate-500 mx-auto" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-200">No Temporal Data Yet</p>
                    <p className="text-slate-400 mt-1 text-sm">
                      Run a Batch Analysis to visualize monthly claim distributions and detect billing spikes.
                    </p>
                  </div>
                  <button
                    onClick={runBatchAnalysis}
                    disabled={isBatchAnalyzing}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isBatchAnalyzing ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />Generating 500 Claims...</>
                    ) : (
                      <><Activity className="w-5 h-5" />Generate Batch &amp; View Timeline</>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* AI Investigator */}
        {activeTab === 'investigator' && (() => {
          // Try to parse investigatorResponse as JSON for rich display
          let parsedInvestigation = null;
          if (investigatorResponse) {
            try { parsedInvestigation = JSON.parse(investigatorResponse); } catch (_) { }
          }

          return (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                  <Bot className="w-6 h-6 text-violet-400" />
                  AI Fraud Investigator
                </h2>
                <p className="text-slate-400 mt-1 text-sm">
                  Ask questions about the analyzed claims data in plain English
                </p>
              </div>

              {/* Search Panel */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/30">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={investigatorQuery}
                    onChange={(e) => setInvestigatorQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && askInvestigator()}
                    placeholder="e.g., Which providers have the highest fraud risk?"
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all"
                  />
                  <button
                    onClick={askInvestigator}
                    disabled={isInvestigating || !investigatorQuery.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium hover:from-violet-500 hover:to-violet-400 transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-violet-500/20"
                  >
                    {isInvestigating
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Search className="w-5 h-5" />}
                    Investigate
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    'Which providers have the highest fraud risk?',
                    'Show me GLP-1 prescribing patterns',
                    'Identify potential kickback schemes',
                    'What are the top investigation priorities?'
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInvestigatorQuery(q)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/60 text-sm text-slate-400 border border-slate-700/40 hover:text-slate-200 hover:bg-slate-700/60 hover:border-slate-600/60 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              {investigatorResponse && parsedInvestigation && (parsedInvestigation.riskLevel || parsedInvestigation.reasoning) ? (
                <div className="space-y-4">
                  {/* Top status row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                      <Bot className="w-5 h-5 text-violet-400" />
                      Investigation Results
                    </h3>
                    {parsedInvestigation.riskLevel && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getRiskColor(parsedInvestigation.riskLevel)}`}>
                        {parsedInvestigation.riskLevel} RISK
                      </span>
                    )}
                    {parsedInvestigation.recommendedAction && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${parsedInvestigation.recommendedAction === 'BLOCK' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                          parsedInvestigation.recommendedAction === 'REVIEW' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                        → {parsedInvestigation.recommendedAction}
                      </span>
                    )}
                  </div>

                  {/* Fraud probability meter */}
                  {parsedInvestigation.fraudProbability != null && (() => {
                    const pct = Math.round(parsedInvestigation.fraudProbability * 100);
                    return (
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-slate-400">Fraud Probability Score</span>
                          <span className={`text-2xl font-bold ${pct >= 70 ? 'text-red-400' : pct >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-700/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${pct >= 70 ? 'bg-gradient-to-r from-red-600 to-red-400' : pct >= 40 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                          <span>Low Risk</span><span>Medium</span><span>High Risk</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Reasoning */}
                  {parsedInvestigation.reasoning && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 to-slate-800/50 border border-violet-500/20">
                      <h4 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                        <Brain className="w-4 h-4" /> AI Reasoning
                      </h4>
                      <p className="text-slate-200 text-sm leading-relaxed">{parsedInvestigation.reasoning}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Clinical Evidence */}
                    {parsedInvestigation.clinicalEvidence?.length > 0 && (
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                        <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Clinical Evidence
                        </h4>
                        <ul className="space-y-2.5">
                          {parsedInvestigation.clinicalEvidence.map((e, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 inline-block" />
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Investigation */}
                    {parsedInvestigation.suggestedInvestigation && (
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-amber-500/20">
                        <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                          <Search className="w-4 h-4" /> Suggested Actions
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">{parsedInvestigation.suggestedInvestigation}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : investigatorResponse ? (
                /* Plain text fallback */
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-violet-400" />
                    Investigation Results
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{investigatorResponse}</p>
                </div>
              ) : null}
            </div>
          );
        })()}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-slate-800/50 bg-slate-900/30 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>RxHCC Fraud Detection System • Amazon Nova Integration</p>
            <p>Healthcare FWA Detection Pipeline v2.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}