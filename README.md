# RxHCC Fraud Detection System
### Powered by Amazon Nova AI

A production-grade **Healthcare Fraud, Waste & Abuse (FWA) Detection** dashboard built with React + Vite. It combines clinical rule-based analysis (ICD-10, NDC, HCC codes) with Amazon Nova AI for intelligent claim investigation.

---

## ✨ Features

| Tab | Feature |
|-----|---------|
| 🔍 **Single Claim** | Analyze individual claims across 5 fraud scenarios |
| 📊 **Batch Analysis** | Generate & analyze 500 synthetic claims (15% anomaly rate) |
| 🕸️ **Network Graph** | Detect provider relationships, hub providers, doctor shopping |
| 📅 **Temporal Analysis** | SVG bar chart with monthly anomaly spike detection |
| 🤖 **AI Investigator** | Natural-language query interface with structured AI results |

---

## 🛡️ Clinical Rule Engine

- **ICD-10 Codes** — Validates diagnosis coverage
- **NDC Drug Codes** — Cross-checks drug-indication matching (GLP-1, Keytruda, etc.)
- **HCC Risk Scores** — Flags upcoding when combined score > 1.5
- **Duplicate Billing Detection** — Catches repeated NDC codes in single claims

---

## 🤖 Amazon Nova Integration

The app connects to **Amazon Nova Pro** via API Gateway + Lambda + Bedrock proxy.

**Without an endpoint** → operates in full **Rule-Based Mode** with simulated AI responses.  
**With an endpoint** → routes prompts to `amazon.nova-pro-v1:0` for real clinical AI analysis.

### API Gateway Setup (Optional)
Deploy this Lambda behind API Gateway:
```python
import boto3, json

def handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    body = json.loads(event['body'])
    response = bedrock.converse(
        modelId=body.get('modelId', 'amazon.nova-pro-v1:0'),
        messages=body['messages'],
        system=body.get('system', []),
        inferenceConfig=body.get('inferenceConfig', {'maxTokens': 1024})
    )
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(response)
    }
```

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/sechan9999/RxHccNova.git
cd RxHccNova

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## ⚙️ Configuration

In the app, click ⚙️ **Settings** in the top-right to enter your API endpoint:

```
https://your-api-gateway.execute-api.us-east-1.amazonaws.com/prod/invoke
```

Leave blank to use Rule-Based Mode (no AWS required).

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Charts | Inline SVG |
| AI Backend | Amazon Nova Pro (via Bedrock) |
| Deployment | Vite dev server / `npm run build` |

---

## 📁 Project Structure

```
src/
├── RXHCCnva.jsx    # Main component (all tabs, rule engine, AI calls)
├── App.jsx          # Root wrapper
├── main.jsx         # Entry point
└── index.css        # Tailwind directives + global styles
```

---

## ⚠️ Security Notes

- **No API keys are stored** in the source code
- The Amazon Nova endpoint URL is entered at runtime via the Settings panel (not persisted)
- All claim data shown is **synthetic / simulated** — no real patient data is used

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built for the AWS Healthcare FWA Hackathon · Amazon Nova Integration Demo*
