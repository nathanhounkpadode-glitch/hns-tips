// HNS TIPS — JAVASCRIPT FRONTEND LOGIC (DAILY PRONOSTICS & CUSTOM MATCH ANALYZER)

let appData = null;
let currentDay = "today";
let currentCategory = "singles"; // 'singles' or 'combos'
let selectedRisk = "safe";
let selectedCount = 3;

// Switch Bottom Tabs (Home / Generator / Bankroll)
function switchTab(tabName) {
    document.querySelectorAll(".tab-view").forEach(tab => tab.classList.remove("active"));
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    const targetNav = Array.from(document.querySelectorAll(".nav-item")).find(item => 
        item.getAttribute("onclick") && item.getAttribute("onclick").includes(tabName)
    );
    if (targetNav) targetNav.classList.add("active");
}

// Load App Data from API or LocalStorage / default dataset
async function loadAppData() {
    try {
        const response = await fetch(`/api/data`);
        if (!response.ok) throw new Error("API status " + response.status);
        appData = await response.json();
    } catch (err) {
        console.warn("Mode autonome (API non connectée) : utilisation des données intégrées.", err);
        const saved = localStorage.getItem("hns_tips_data");
        if (saved) {
            try { appData = JSON.parse(saved); } catch (e) { appData = window.DEFAULT_HNS_DATA; }
        } else {
            appData = window.DEFAULT_HNS_DATA || null;
        }
    }
    renderCurrentDayView();
    renderStats();
}

// Switch Day (Aujourd'hui / Demain / Week-end)
function setDay(dayKey) {
    currentDay = dayKey;
    document.querySelectorAll(".day-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.day === dayKey);
    });
    renderCurrentDayView();
}

// Switch Category (Paris Simples vs Combinés Prêts)
function setCategory(catKey) {
    currentCategory = catKey;
    const isSingles = catKey === "singles";

    document.getElementById("toggleSingles").classList.toggle("active", isSingles);
    document.getElementById("toggleCombos").classList.toggle("active", !isSingles);

    document.getElementById("viewSingles").classList.toggle("active", isSingles);
    document.getElementById("viewCombos").classList.toggle("active", !isSingles);
}

// Render the active day's content
function renderCurrentDayView() {
    if (!appData || !appData.days) return;
    const day = appData.days[currentDay];
    if (!day) return;

    // Render Banker
    const b = day.banker;
    if (b) {
        document.getElementById("bankerLeague").textContent = b.competition;
        document.getElementById("bankerTime").textContent = `${day.label} • ${b.time}`;
        document.getElementById("bankerMatch").textContent = b.match;
        document.getElementById("bankerPick").textContent = b.pick;
        document.getElementById("bankerOdds").textContent = `Cote : ${b.odds}`;
        document.getElementById("bankerConfidence").textContent = `${b.confidence}% Confiance`;
        document.getElementById("bankerAnalysis").textContent = b.analysis;
    }

    // Render Singles
    const singlesContainer = document.getElementById("singlesList");
    singlesContainer.innerHTML = "";
    const singles = day.singles || [];
    document.getElementById("singlesCountBadge").textContent = `${singles.length} Matchs Analysés`;

    singles.forEach(s => {
        const card = document.createElement("div");
        card.className = "single-card";

        const typeColor = s.type === "Banker" ? "var(--gold)" : (s.type === "Safe" ? "var(--green-won)" : "#60a5fa");

        card.innerHTML = `
            <div class="single-top">
                <span>🏆 ${s.league} • ⏰ ${s.time}</span>
                <span class="badge-gold" style="color: ${typeColor}; border-color: ${typeColor}; background: rgba(255,255,255,0.06);">${s.type}</span>
            </div>
            <div class="single-match">⚽ ${s.match}</div>
            <div class="single-box">
                <div>
                    <div class="single-market">${s.market}</div>
                    <div class="single-pick">${s.pick}</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span class="confidence-badge">${s.confidence}%</span>
                    <span class="odds-pill">${s.odds}</span>
                </div>
            </div>
            <div class="single-reason">💡 ${s.reason}</div>
        `;
        singlesContainer.appendChild(card);
    });

    // Render Combos
    const combosContainer = document.getElementById("combosList");
    combosContainer.innerHTML = "";
    const combos = day.combos || [];

    combos.forEach(c => {
        const card = document.createElement("div");
        card.className = "combo-card";

        let picksHtml = "";
        c.picks.forEach(p => {
            picksHtml += `
                <div class="combo-pick-row">
                    <div>
                        <div class="combo-pick-name">${p.match}</div>
                        <div style="font-size:0.75rem; color:#93c5fd;">👉 ${p.pick}</div>
                    </div>
                    <span class="combo-pick-odds">${p.odds}</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="combo-card-header">
                <div class="combo-card-title">${c.title}</div>
                <span class="combo-card-odds">Cote : ${c.odds}</span>
            </div>
            <div class="combo-picks">
                ${picksHtml}
            </div>
            <div class="combo-advice">
                <strong>Conseil HNS AI :</strong> ${c.advice}
            </div>
        `;
        combosContainer.appendChild(card);
    });
}

// Render Summary Stats
function renderStats() {
    if (!appData || !appData.stats_summary) return;
    const s = appData.stats_summary;

    document.getElementById("winRateVal").textContent = `${s.win_rate}%`;
    document.getElementById("streakVal").textContent = `${s.current_streak} 🔥`;
    document.getElementById("avgOddsVal").textContent = s.average_odds;
}

// Local Generator Helper (Client-side fallback)
function generateLocalAccumulator(dayKey, risk, count) {
    if (!appData || !appData.days) return null;
    const day = appData.days[dayKey] || appData.days["today"];
    let singles = [...(day.singles || [])];
    
    let candidates = [];
    if (risk === "safe") {
        candidates = singles.filter(s => s.type === "Safe" || s.type === "Banker" || (s.confidence && s.confidence >= 84));
    } else if (risk === "medium") {
        candidates = singles.filter(s => (s.confidence && s.confidence >= 75));
    } else {
        candidates = singles.filter(s => (s.odds >= 1.70) || s.type === "Value");
    }
    if (candidates.length < count) candidates = singles;

    // shuffle
    candidates = candidates.sort(() => Math.random() - 0.5);
    const selected = candidates.slice(0, Math.min(count, candidates.length));

    let totalOdds = 1.0;
    let totalConf = 0;
    selected.forEach(item => {
        totalOdds *= item.odds;
        totalConf += item.confidence;
    });
    const avgConf = selected.length ? Math.round(totalConf / selected.length) : 80;
    totalOdds = Math.round(totalOdds * 100) / 100;

    return {
        status: "success",
        day: dayKey,
        risk_profile: risk,
        total_odds: totalOdds,
        confidence: avgConf,
        picks_count: selected.length,
        picks: selected,
        ai_rationale: `Combiné IA sur mesure (${day.label || ''}) : Cote totale de ${totalOdds} avec un indice de confiance de ${avgConf}%.`
    };
}

// HNS AI Generator (Custom accumulator)
async function generateAccumulator() {
    const btn = document.getElementById("generateComboBtn");
    btn.innerHTML = "⏳ Analyse HNS AI en cours...";
    btn.disabled = true;

    try {
        let result = null;
        try {
            const res = await fetch("/api/generate-accumulator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ day: currentDay, risk: selectedRisk, count: selectedCount })
            });
            if (res.ok) result = await res.json();
        } catch (e) {
            result = null;
        }

        // Fallback local en mode autonome (Netlify, PWA, etc.)
        if (!result || result.status !== "success") {
            result = generateLocalAccumulator(currentDay, selectedRisk, selectedCount);
        }

        if (!result || !result.picks || result.picks.length === 0) {
            throw new Error("Aucun match disponible pour ce filtre.");
        }

        document.getElementById("comboTotalOdds").textContent = `Cote : ${result.total_odds}`;
        document.getElementById("comboConfidenceBar").style.width = `${result.confidence}%`;
        document.getElementById("comboConfidenceText").textContent = `Indice IA : ${result.confidence}%`;
        document.getElementById("comboAiRationale").textContent = result.ai_rationale;

        const picksContainer = document.getElementById("comboPicksList");
        picksContainer.innerHTML = "";

        result.picks.forEach(p => {
            const item = document.createElement("div");
            item.className = "combo-pick-item";
            item.innerHTML = `
                <div class="combo-pick-match">⚽ ${p.match} (${p.league})</div>
                <div class="combo-pick-detail">
                    <span>${p.market} : <strong>${p.pick}</strong></span>
                    <span>Cote : <strong>${p.odds}</strong></span>
                </div>
            `;
            picksContainer.appendChild(item);
        });

        document.getElementById("comboResultCard").style.display = "block";
    } catch (err) {
        console.error("Erreur de génération :", err);
        alert("Erreur lors de la génération du combiné.");
    } finally {
        btn.innerHTML = '<span class="btn-icon">⚡</span> Créer mon Combiné IA';
        btn.disabled = false;
    }
}

// Custom Match Analyzer & Adder
async function submitCustomMatch() {
    const home = document.getElementById("customHome").value.trim();
    const away = document.getElementById("customAway").value.trim();
    const league = document.getElementById("customLeague").value.trim() || "Football";
    const time = document.getElementById("customTime").value.trim() || "20:45";
    const day = document.getElementById("customDay").value;

    if (!home || !away) {
        alert("Veuillez saisir au moins les deux équipes.");
        return;
    }

    const btn = document.getElementById("submitCustomMatchBtn");
    btn.innerHTML = "⏳ Analyse statistique IA...";
    btn.disabled = true;

    try {
        let data = null;
        try {
            const res = await fetch("/api/analyze-custom-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ home, away, league, time, day })
            });
            if (res.ok) data = await res.json();
        } catch (e) {
            data = null;
        }

        // Fallback autonome si serveur absent
        if (!data || data.status !== "success") {
            const homeLow = home.toLowerCase();
            const awayLow = away.toLowerCase();
            const hasMessi = homeLow.includes("messi") || awayLow.includes("messi") || homeLow.includes("miami") || awayLow.includes("miami");
            const hasYamal = homeLow.includes("barça") || awayLow.includes("barca") || homeLow.includes("barcelone") || awayLow.includes("barcelone");

            let pick = `${home} ou Nul & Plus de 1.5 buts`;
            let market = "Double Chance & Buts";
            let odds = 1.70;
            let confidence = 85;
            let typeStr = "Safe";
            let reason = `Avantage à domicile pour ${home} combiné à un rythme offensif favorable aux buts.`;

            if (hasMessi) {
                pick = "Lionel Messi décisif (but ou passe)";
                market = "Buteur / Star";
                odds = 1.68;
                confidence = 90;
                typeStr = "Banker";
                reason = "Statistiques exceptionnelles du N°10 avec une implication majeure.";
            } else if (hasYamal) {
                pick = `${home} ou Nul & Lamine Yamal décisif`;
                market = "Double Chance & Prodige";
                odds = 1.82;
                confidence = 88;
                typeStr = "Safe";
                reason = "Lamine Yamal est le moteur offensif principal avec des percussions constantes.";
            }

            const newSingle = {
                id: `custom_${Date.now()}`,
                league: league,
                time: time,
                match: `${home} vs ${away}`,
                market: market,
                pick: pick,
                odds: odds,
                confidence: confidence,
                type: typeStr,
                reason: reason
            };

            const targetDay = (appData && appData.days && appData.days[day]) ? day : "today";
            if (!appData.days[targetDay].singles) appData.days[targetDay].singles = [];
            appData.days[targetDay].singles.unshift(newSingle);
            localStorage.setItem("hns_tips_data", JSON.stringify(appData));
            data = { status: "success" };
        }

        if (data.status === "success") {
            document.getElementById("addMatchModal").style.display = "none";
            document.getElementById("customHome").value = "";
            document.getElementById("customAway").value = "";
            setDay(day);
            await loadAppData();
            alert(`✅ Match ${home} vs ${away} analysé et ajouté aux pronostics de ${day === 'today' ? "aujourd'hui" : day} !`);
        }
    } catch (err) {
        console.error("Erreur d'analyse :", err);
        alert("Erreur lors de l'analyse du match.");
    } finally {
        btn.innerHTML = "🤖 Analyser & Ajouter le Pronostic";
        btn.disabled = false;
    }
}

// Bankroll Stake Calculator
async function calculateStake() {
    const bankroll = parseFloat(document.getElementById("bankrollInput").value) || 100;
    const odds = parseFloat(document.getElementById("oddsInput").value) || 1.85;
    const confidence = parseFloat(document.getElementById("confidenceInput").value) || 80;

    let data = null;
    try {
        const res = await fetch("/api/calculate-stake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bankroll, odds, confidence })
        });
        if (res.ok) data = await res.json();
    } catch (err) {
        data = null;
    }

    if (!data) {
        // Fallback local Kelly formula
        const b = odds - 1;
        const p = (confidence / 100.0) * 0.95;
        const q = 1.0 - p;
        let f = (b > 0) ? ((b * p) - q) / b : 0;
        if (f < 0) f = 0;
        const safeFraction = f * 0.5;
        const stakePercent = Math.round(Math.min(safeFraction * 100, 10.0) * 10) / 10;
        const stakeAmount = Math.max(1, Math.round((bankroll * (stakePercent / 100)) * 10) / 10);
        const potGain = Math.round((stakeAmount * odds) * 100) / 100;
        const potProfit = Math.round((potGain - stakeAmount) * 100) / 100;

        data = {
            recommended_stake: stakeAmount,
            stake_percentage: stakePercent,
            potential_gain: potGain,
            potential_profit: potProfit,
            advice: `Mise modérée de sécurité (${stakePercent}% de bankroll). Ne jamais dépasser ce montant.`
        };
    }

    document.getElementById("recommendedStake").textContent = `${data.recommended_stake} € (${data.stake_percentage}%)`;
    document.getElementById("potentialGain").textContent = `${data.potential_gain} € (Bénéfice : +${data.potential_profit} €)`;
    document.getElementById("stakeAdvice").textContent = `💡 ${data.advice}`;
    document.getElementById("stakeResultBox").style.display = "block";
}

// Setup Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    loadAppData();

    // Day buttons
    document.querySelectorAll(".day-btn").forEach(btn => {
        btn.addEventListener("click", () => setDay(btn.dataset.day));
    });

    // Category toggle
    document.getElementById("toggleSingles").addEventListener("click", () => setCategory("singles"));
    document.getElementById("toggleCombos").addEventListener("click", () => setCategory("combos"));

    // Modal open/close
    const modal = document.getElementById("addMatchModal");
    const openBtns = [document.getElementById("openAddModalBtn"), document.getElementById("openAddModalBtn2")];
    openBtns.forEach(b => {
        if (b) b.addEventListener("click", () => modal.style.display = "flex");
    });
    document.getElementById("closeAddModalBtn").addEventListener("click", () => modal.style.display = "none");
    document.getElementById("submitCustomMatchBtn").addEventListener("click", submitCustomMatch);

    // Generator buttons
    document.querySelectorAll(".risk-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".risk-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedRisk = btn.dataset.risk;
        });
    });

    document.querySelectorAll(".count-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".count-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedCount = parseInt(btn.dataset.count);
        });
    });

    document.getElementById("generateComboBtn").addEventListener("click", generateAccumulator);
    document.getElementById("calculateStakeBtn").addEventListener("click", calculateStake);
    document.getElementById("refreshBtn").addEventListener("click", () => {
        loadAppData();
        alert("Pronostics actualisés !");
    });
});
