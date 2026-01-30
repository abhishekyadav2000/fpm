from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import httpx
import os
import uuid
import json

app = FastAPI(title="FPM Agents Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")
ANALYTICS_URL = os.getenv("ANALYTICS_URL", "http://localhost:5000")
API_URL = os.getenv("API_URL", "http://localhost:4000")

# In-memory store for agent runs (in production, use database)
agent_runs = {}
agent_steps = {}

class RunRequest(BaseModel):
    user_id: str
    workflow: str
    params: Optional[dict] = None

class RunResponse(BaseModel):
    run_id: str
    status: str
    output: Optional[dict] = None

async def call_ollama(prompt: str, system: str = None) -> str:
    """Call Ollama LLM"""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("message", {}).get("content", "")
            else:
                return f"Error calling Ollama: {response.status_code}"
    except Exception as e:
        return f"Ollama unavailable: {str(e)}. Using fallback response."

async def get_analytics(endpoint: str, params: dict) -> dict:
    """Call analytics service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{ANALYTICS_URL}{endpoint}", params=params)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Analytics error: {e}")
    return {}

def log_step(run_id: str, agent: str, action: str, input_data: dict, output_data: dict, evidence_ids: list):
    """Log agent step for audit"""
    step_id = str(uuid.uuid4())
    step = {
        "id": step_id,
        "run_id": run_id,
        "agent": agent,
        "action": action,
        "input": input_data,
        "output": output_data,
        "evidence_ids": evidence_ids,
        "created_at": datetime.now().isoformat()
    }
    if run_id not in agent_steps:
        agent_steps[run_id] = []
    agent_steps[run_id].append(step)
    return step

# ============ AGENTS ============

async def ingestion_agent(run_id: str, user_id: str) -> dict:
    """Gather all metrics from analytics service"""
    cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id})
    burn_rate = await get_analytics("/metrics/burn-rate", {"user_id": user_id})
    net_worth = await get_analytics("/metrics/net-worth", {"user_id": user_id})
    portfolio = await get_analytics("/metrics/portfolio-summary", {"user_id": user_id})
    
    evidence_ids = []
    evidence_ids.extend(cashflow.get("evidence_ids", []))
    evidence_ids.extend(burn_rate.get("evidence_ids", []))
    evidence_ids.extend(net_worth.get("evidence_ids", []))
    evidence_ids.extend(portfolio.get("evidence_ids", []))
    
    output = {
        "cashflow": cashflow,
        "burn_rate": burn_rate,
        "net_worth": net_worth,
        "portfolio": portfolio,
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "IngestionAgent", "gather_metrics", {"user_id": user_id}, output, evidence_ids)
    return output

async def ledger_intel_agent(run_id: str, metrics: dict) -> dict:
    """Analyze spending patterns and anomalies"""
    cashflow = metrics.get("cashflow", {}).get("data", [])
    burn_rate = metrics.get("burn_rate", {})
    
    # Build analysis prompt
    prompt = f"""Analyze these financial metrics and identify patterns:

Cashflow (last 6 months):
{json.dumps(cashflow, indent=2)}

Burn Rate:
- Average: ${burn_rate.get('avg_burn_rate', 0):,.2f}/month
- Range: ${burn_rate.get('min_month', 0):,.2f} - ${burn_rate.get('max_month', 0):,.2f}

Identify:
1. Any concerning spending patterns
2. Month-over-month trends
3. Categories that might need attention

Keep response brief (3-5 bullet points). Reference the specific numbers provided."""

    system = "You are a financial analyst. Only reference numbers explicitly provided. Never invent statistics."
    
    analysis = await call_ollama(prompt, system)
    evidence_ids = metrics.get("evidence_ids", [])
    
    output = {
        "analysis": analysis,
        "metrics_summary": {
            "avg_burn_rate": burn_rate.get("avg_burn_rate", 0),
            "months_analyzed": len(cashflow)
        },
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "LedgerIntelAgent", "analyze_spending", {"metrics": "provided"}, output, evidence_ids)
    return output

async def portfolio_analyst_agent(run_id: str, metrics: dict) -> dict:
    """Analyze portfolio allocation and performance"""
    portfolio = metrics.get("portfolio", {})
    holdings = portfolio.get("holdings", [])
    
    prompt = f"""Analyze this investment portfolio:

Holdings:
{json.dumps(holdings, indent=2)}

Total Value: ${portfolio.get('total_value', 0):,.2f}
Total Cost: ${portfolio.get('total_cost', 0):,.2f}
Total Gain/Loss: ${portfolio.get('total_gain_loss', 0):,.2f}
Return: {portfolio.get('total_return_pct', 0):.1f}%

Provide:
1. Assessment of diversification
2. Any concentration risks
3. Performance observations

Keep brief (3-4 bullet points). Only reference the provided holdings."""

    system = "You are a portfolio analyst. Only discuss the specific holdings provided. Never mention securities not in the list."
    
    analysis = await call_ollama(prompt, system)
    evidence_ids = portfolio.get("evidence_ids", [])
    
    output = {
        "analysis": analysis,
        "portfolio_summary": {
            "total_value": portfolio.get("total_value", 0),
            "total_return_pct": portfolio.get("total_return_pct", 0),
            "num_holdings": len(holdings)
        },
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "PortfolioAnalystAgent", "analyze_portfolio", {"num_holdings": len(holdings)}, output, evidence_ids)
    return output

async def risk_safety_agent(run_id: str, analyses: dict) -> dict:
    """Validate that all outputs are properly grounded in evidence"""
    
    all_evidence = set()
    issues = []
    
    for agent_name, agent_output in analyses.items():
        evidence = agent_output.get("evidence_ids", [])
        all_evidence.update(evidence)
        
        # Check if analysis exists without evidence
        if agent_output.get("analysis") and not evidence:
            issues.append(f"{agent_name}: analysis present but no evidence IDs")
    
    is_grounded = len(issues) == 0 and len(all_evidence) > 0
    
    output = {
        "is_grounded": is_grounded,
        "total_evidence_count": len(all_evidence),
        "evidence_ids": list(all_evidence),
        "issues": issues,
        "verdict": "PASS" if is_grounded else "FAIL: " + "; ".join(issues)
    }
    
    log_step(run_id, "RiskSafetyAgent", "validate_grounding", {"num_analyses": len(analyses)}, output, list(all_evidence))
    return output

async def decision_coach_agent(run_id: str, analyses: dict, safety: dict) -> dict:
    """Generate actionable recommendations"""
    
    if not safety.get("is_grounded", False):
        return {
            "recommendations": [],
            "blocked": True,
            "reason": "NOT GROUNDED: " + safety.get("verdict", "Unknown safety issue"),
            "evidence_ids": []
        }
    
    ledger = analyses.get("ledger_intel", {})
    portfolio = analyses.get("portfolio_analyst", {})
    
    prompt = f"""Based on these analyses, suggest 2-3 specific actionable recommendations:

Spending Analysis:
{ledger.get('analysis', 'Not available')}

Portfolio Analysis:
{portfolio.get('analysis', 'Not available')}

Format each recommendation as:
- [ACTION]: Brief description

Be specific and actionable. Reference the analyses provided."""

    system = "You are a financial coach. Provide practical, actionable advice based only on the analyses provided."
    
    recommendations = await call_ollama(prompt, system)
    evidence_ids = safety.get("evidence_ids", [])
    
    output = {
        "recommendations": recommendations,
        "blocked": False,
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "DecisionCoachAgent", "generate_recommendations", {}, output, evidence_ids)
    return output

async def narrator_agent(run_id: str, all_outputs: dict) -> dict:
    """Generate final human-readable summary"""
    
    safety = all_outputs.get("safety", {})
    if not safety.get("is_grounded", False):
        return {
            "summary": f"⚠️ {safety.get('reason', 'Analysis could not be completed due to missing evidence.')}",
            "evidence_ids": []
        }
    
    ledger = all_outputs.get("ledger_intel", {})
    portfolio = all_outputs.get("portfolio_analyst", {})
    coach = all_outputs.get("decision_coach", {})
    
    prompt = f"""Create a brief financial digest (3-4 paragraphs) summarizing:

Spending Insights:
{ledger.get('analysis', 'N/A')}

Portfolio Status:
{portfolio.get('analysis', 'N/A')}

Recommendations:
{coach.get('recommendations', 'N/A')}

Write in a friendly, conversational tone. Start with a greeting like "Here's your financial snapshot..."
End with an encouraging note."""

    system = "You are a friendly financial advisor writing a daily digest. Be warm but professional."
    
    summary = await call_ollama(prompt, system)
    evidence_ids = safety.get("evidence_ids", [])
    
    output = {
        "summary": summary,
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "NarratorAgent", "generate_summary", {}, output, evidence_ids)
    return output

# ============ WORKFLOWS ============

async def daily_digest_workflow(run_id: str, user_id: str) -> dict:
    """Run full daily digest workflow"""
    
    # Step 1: Ingest metrics
    metrics = await ingestion_agent(run_id, user_id)
    
    # Step 2: Run analysis agents in parallel
    ledger_analysis = await ledger_intel_agent(run_id, metrics)
    portfolio_analysis = await portfolio_analyst_agent(run_id, metrics)
    
    analyses = {
        "ledger_intel": ledger_analysis,
        "portfolio_analyst": portfolio_analysis
    }
    
    # Step 3: Validate grounding
    safety = await risk_safety_agent(run_id, analyses)
    
    # Step 4: Generate recommendations
    coach = await decision_coach_agent(run_id, analyses, safety)
    
    # Step 5: Generate final narrative
    all_outputs = {
        **analyses,
        "safety": safety,
        "decision_coach": coach
    }
    narrative = await narrator_agent(run_id, all_outputs)
    
    return {
        "digest": narrative.get("summary", ""),
        "recommendations": coach.get("recommendations", ""),
        "is_grounded": safety.get("is_grounded", False),
        "evidence_count": safety.get("total_evidence_count", 0),
        "evidence_ids": safety.get("evidence_ids", [])
    }

# ============ API ENDPOINTS ============

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = "default"
    context: Optional[dict] = None

class ChatResponse(BaseModel):
    response: str
    evidence_ids: Optional[list] = None
    suggestions: Optional[list] = None

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agents", "model": OLLAMA_MODEL}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Interactive chat with financial AI advisor"""
    
    # Build context from user's financial data
    context_summary = ""
    evidence_ids = []
    
    try:
        # Get user's financial context if we have their data
        cashflow = await get_analytics("/metrics/cashflow", {"user_id": request.user_id, "months": 3})
        net_worth = await get_analytics("/metrics/net-worth", {"user_id": request.user_id})
        
        if cashflow.get("data"):
            latest = cashflow["data"][0] if cashflow["data"] else {}
            context_summary += f"\nRecent monthly income: ${latest.get('income', 0):,.0f}"
            context_summary += f"\nRecent monthly expenses: ${latest.get('expenses', 0):,.0f}"
            evidence_ids.append("cashflow-data")
        
        if net_worth.get("net_worth"):
            context_summary += f"\nNet worth: ${net_worth['net_worth']:,.0f}"
            evidence_ids.append("net-worth-data")
            
    except Exception as e:
        context_summary = "\nNo financial data available yet."
    
    system_prompt = f"""You are a helpful personal finance advisor. You provide practical, actionable advice.
    
User's Financial Context:{context_summary if context_summary else ' No data available yet - encourage them to add accounts and transactions.'}

Guidelines:
- Be concise and friendly
- Give specific, actionable advice
- If you don't have enough data, suggest what they should add
- Never make up numbers - only reference the context provided
- Keep responses under 150 words"""

    response = await call_ollama(request.message, system_prompt)
    
    # Generate follow-up suggestions
    suggestions = []
    if "budget" in request.message.lower():
        suggestions = ["How should I allocate my income?", "What's the 50/30/20 rule?", "Help me cut expenses"]
    elif "invest" in request.message.lower():
        suggestions = ["Am I diversified enough?", "What's a good savings rate?", "Index funds vs individual stocks?"]
    elif "save" in request.message.lower():
        suggestions = ["How much should I save monthly?", "Emergency fund tips", "Automate my savings"]
    else:
        suggestions = ["Analyze my spending", "Create a budget", "Investment advice"]
    
    return ChatResponse(
        response=response,
        evidence_ids=evidence_ids if evidence_ids else None,
        suggestions=suggestions
    )

@app.post("/quick-insight")
async def quick_insight(user_id: str = "default"):
    """Get a quick AI insight based on current financial state"""
    
    # Gather data
    cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id, "months": 1})
    
    if not cashflow.get("data"):
        return {
            "insight": "Start by adding your accounts and transactions to get personalized insights!",
            "type": "tip",
            "action": "Add an account"
        }
    
    latest = cashflow["data"][0]
    income = latest.get("income", 0)
    expenses = latest.get("expenses", 0)
    savings_rate = ((income - expenses) / income * 100) if income > 0 else 0
    
    if savings_rate >= 20:
        insight = f"Great job! You're saving {savings_rate:.0f}% of your income this month."
        insight_type = "achievement"
    elif savings_rate >= 0:
        insight = f"You're saving {savings_rate:.0f}% of your income. Try to reach 20% for long-term wealth building."
        insight_type = "tip"
    else:
        insight = f"You're spending more than you earn. Let's review your expenses together."
        insight_type = "warning"
    
    return {
        "insight": insight,
        "type": insight_type,
        "savings_rate": savings_rate,
        "evidence": ["cashflow-data"]
    }

@app.post("/run", response_model=RunResponse)
async def run_workflow(request: RunRequest):
    """Execute an agent workflow"""
    run_id = str(uuid.uuid4())
    
    # Initialize run
    agent_runs[run_id] = {
        "id": run_id,
        "user_id": request.user_id,
        "workflow": request.workflow,
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "input": request.params
    }
    
    try:
        if request.workflow == "daily-digest":
            output = await daily_digest_workflow(run_id, request.user_id)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown workflow: {request.workflow}")
        
        agent_runs[run_id]["status"] = "completed"
        agent_runs[run_id]["output"] = output
        agent_runs[run_id]["completed_at"] = datetime.now().isoformat()
        
        return RunResponse(run_id=run_id, status="completed", output=output)
        
    except Exception as e:
        agent_runs[run_id]["status"] = "failed"
        agent_runs[run_id]["error"] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get status and output of a run"""
    if run_id not in agent_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return agent_runs[run_id]

@app.get("/runs/{run_id}/steps")
async def get_run_steps(run_id: str):
    """Get all steps for a run (audit log)"""
    if run_id not in agent_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return agent_steps.get(run_id, [])

@app.get("/runs")
async def list_runs(user_id: str = Query(None), limit: int = 20):
    """List recent runs"""
    runs = list(agent_runs.values())
    if user_id:
        runs = [r for r in runs if r.get("user_id") == user_id]
    runs.sort(key=lambda x: x.get("started_at", ""), reverse=True)
    return runs[:limit]

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "6000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
