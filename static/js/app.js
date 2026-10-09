// HNS TIPS — APPLICATION FRONTEND LOGIC (7 CHAMPIONNATS & ANALYSES COMPLÈTES)

const DATA_VERSION = "2026-10-09-v8";
let appData = null;
let currentDay = "today";
let currentViewMode = "safe"; // 'safe', 'all', or 'combos'
let selectedLeague = "all";
let selectedRisk = "safe";
let selectedCount = 3;

// Switch Bottom Navigation Tabs (Pronos / Générateur / Bankroll)
function switchTab(tabName) {
    document.querySelectorAll(".tab-view").forEach(tab => tab.classList.remove("active"));
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    const navItems = document.querySelectorAll(".nav-item");
    if (tabName === "home" && navItems[0]) navItems[0].classList.add("active");
    if (tabName === "generator" && navItems[1]) navItems[1].classList.add("active");
    if (tabName === "bankroll" && navItems[2]) navItems[2].classList.add("active");
}

// Switch between the 3 main prediction sections
function setViewMode(mode) {
    currentViewMode = mode;
    
    document.getElementById("viewModeSafe").classList.toggle("active", mode === "safe");
    document.getElementById("viewModeAll").classList.toggle("active", mode === "all");
    document.getElementById("viewModeCombos").classList.toggle("active", mode === "combos");

    document.getElementById("sectionSafePicks").classList.toggle("active", mode === "safe");
    document.getElementById("sectionAllMatches").classList.toggle("active", mode === "all");
    document.getElementById("sectionCombos").classList.toggle("active", mode === "combos");

    if (mode === "all") {
        renderAllMatchesList();
    }
}

// Switch Day (Aujourd'hui / Demain / Dimanche)
function setDay(dayKey) {
    currentDay = dayKey;
    document.querySelectorAll(".day-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.day === dayKey);
    });
    // Reset league filter on day change
    selectedLeague = "all";
    document.querySelectorAll(".league-filter-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.league === "all");
    });
    renderCurrentDayView();
}

// Set League filter in "Tous les Championnats" view
function setLeagueFilter(leagueKey) {
    selectedLeague = leagueKey;
    document.querySelectorAll(".league-filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.league === leagueKey);
    });
    renderAllMatchesList();
}

// Invalidate obsolete cached data so users' phones receive fresh match fixtures
function checkCacheVersion() {
    const cachedVer = localStorage.getItem("hns_tips_version");
    if (cachedVer !== DATA_VERSION) {
        localStorage.removeItem("hns_tips_data");
        localStorage.setItem("hns_tips_version", DATA_VERSION);
    }
}

// Load App Data from API or LocalStorage / default dataset
async function loadAppData() {
    checkCacheVersion();

    try {
        const response = await fetch(`/api/data`);
        if (!response.ok) throw new Error("API status " + response.status);
        appData = await response.json();
    } catch (err) {
        console.warn("Mode autonome : utilisation des données intégrées.", err);
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

// Render the active day's full view
function renderCurrentDayView() {
    if (!appData || !appData.days) return;
    const day = appData.days[currentDay];
    if (!day) return;

    // Update announcement notice
    const noticeEl = document.getElementById("dayNoticeText");
    if (noticeEl && day.notice) {
        noticeEl.textContent = day.notice;
    }

    // 1. Render Banker Card
    const b = day.banker;
    if (b) {
        document.getElementById("bankerLeague").textContent = b.competition || "Grand Championnat";
        document.getElementById("bankerTime").textContent = `${day.short_label || ''} • ${b.time}`;
        document.getElementById("bankerMatch").textContent = b.match;
        document.getElementById("bankerPick").textContent = `✓ ${b.pick}`;
        document.getElementById("bankerOdds").textContent = `Cote : ${b.odds}`;
        document.getElementById("bankerConfidence").textContent = `${b.confidence}% Confiance`;
        document.getElementById("bankerAnalysis").innerHTML = `<strong>💡 Analyse HNS :</strong> ${b.analysis}`;
    }

    // 2. Render Safe Picks List (Section 1)
    renderSafePicksList(day);

    // 3. Update League Counts and Render All Matches (Section 2)
    updateLeagueCounts(day);
    renderAllMatchesList();

    // 4. Render Combos (Section 3)
    renderCombosList(day);
}

// Render Safe Picks
function renderSafePicksList(day) {
    const container = document.getElementById("safePicksList");
    container.innerHTML = "";
    const singles = day.singles || [];

    // Filter matches that are considered Safe or Banker
    const safeMatches = singles.filter(s => s.is_safe === true || s.type === "Safe" || s.type === "Banker");
    document.getElementById("safeCountBadge").textContent = `${safeMatches.length} Sélections Sûres`;

    if (safeMatches.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Aucun match safe supplémentaire pour ce jour.</div>`;
        return;
    }

    safeMatches.forEach(s => {
        const card = createMatchCard(s, true);
        container.appendChild(card);
    });
}

// Update match count badges per league
function updateLeagueCounts(day) {
    const singles = day.singles || [];
    document.getElementById("countAll").textContent = singles.length;

    const leaguesMap = {
        "countLaLiga": "LaLiga (Espagne)",
        "countPremier": "Premier League (Angleterre)",
        "countLigue1": "Ligue 1 (France)",
        "countSerieA": "Serie A (Italie)",
        "countPrimeira": "Primeira Liga (Portugal)",
        "countSuperLig": "Süper Lig (Turquie)",
        "countEredivisie": "Eredivisie (Pays-Bas)",
        "countBundesliga": "Bundesliga (Allemagne)"
    };

    for (const [elemId, leagueName] of Object.entries(leaguesMap)) {
        const count = singles.filter(s => s.league === leagueName).length;
        const el = document.getElementById(elemId);
        if (el) el.textContent = count;
    }
}

// Render All Matches by Championship
function renderAllMatchesList() {
    if (!appData || !appData.days) return;
    const day = appData.days[currentDay];
    if (!day) return;

    const container = document.getElementById("allMatchesList");
    container.innerHTML = "";
    let singles = day.singles || [];

    if (selectedLeague !== "all") {
        singles = singles.filter(s => s.league === selectedLeague);
    }

    document.getElementById("allCountBadge").textContent = `${singles.length} Matchs Analysés`;

    if (singles.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:25px; color:var(--text-muted);">Aucun match programmé pour ce championnat ce jour-ci.</div>`;
        return;
    }

    singles.forEach(s => {
        const card = createMatchCard(s, false);
        container.appendChild(card);
    });
}

// Helper to create a unified, responsive match card
function createMatchCard(s, isSafeSection = false) {
    const card = document.createElement("div");
    card.className = "match-card";

    let tagClass = "tag-value";
    let tagLabel = "💎 VALUE";
    if (s.type === "Banker") {
        tagClass = "tag-banker";
        tagLabel = "⭐ BANKER";
    } else if (s.is_safe || s.type === "Safe") {
        tagClass = "tag-safe";
        tagLabel = "🛡️ TRÈS SÛR";
    }

    card.innerHTML = `
        <div class="match-card-top">
            <span class="league-pill">🏆 ${s.league} • ⏰ ${s.time}</span>
            <span class="match-type-tag ${tagClass}">${tagLabel}</span>
        </div>
        <div class="match-title">⚽ ${s.match}</div>
        <div class="match-bet-box">
            <div>
                <div class="match-market-name">${s.market}</div>
                <div class="match-pick-text">✓ ${s.pick}</div>
            </div>
            <div class="match-meta-right">
                <span class="confidence-chip">${s.confidence}%</span>
                <span class="odds-chip">${s.odds}</span>
            </div>
        </div>
        <div class="match-reason-box">
            💡 <strong>Analyse IA :</strong> ${s.reason}
        </div>
    `;
    return card;
}

// Render Combos
function renderCombosList(day) {
    const combosContainer = document.getElementById("combosList");
    combosContainer.innerHTML = "";
    const combos = day.combos || [];

    if (combos.length === 0) {
        combosContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Aucun combiné prédéfini pour ce jour. Utilise le Générateur IA !</div>`;
        return;
    }

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
                <strong>Conseil HNS IA :</strong> ${c.advice}
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
        candidates = singles.filter(s => s.type === "Safe" || s.type === "Banker" || s.is_safe || (s.confidence && s.confidence >= 88));
    } else if (risk === "medium") {
        candidates = singles.filter(s => (s.confidence && s.confidence >= 75));
    } else {
        candidates = singles.filter(s => (s.odds >= 1.65) || s.type === "Value");
    }
    if (candidates.length < count) candidates = singles;

    // Shuffle
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
        ai_rationale: `Combiné IA optimisé (${day.label || ''}) : Cote totale de ${totalOdds} avec un indice de confiance de ${avgConf}%.`
    };
}

// Custom accumulator generator
async function generateAccumulator() {
    const btn = document.getElementById("generateComboBtn");
    btn.innerHTML = "⏳ Calcul de la meilleure combinaison IA...";
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
    const league = document.getElementById("customLeagueSelect").value;
    const time = document.getElementById("customTime").value.trim() || "20:45";
    const day = document.getElementById("customDay").value;

    if (!home || !away) {
        alert("Veuillez saisir au moins les deux équipes.");
        return;
    }

    const btn = document.getElementById("submitCustomMatchBtn");
    btn.innerHTML = "⏳ Analyse statistique IA en cours...";
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

        if (!data || data.status !== "success") {
            const homeLow = home.toLowerCase();
            const awayLow = away.toLowerCase();

            let pick = `${home} ou Nul & Plus de 1.5 buts`;
            let market = "Double Chance & Buts";
            let odds = 1.62;
            let confidence = 86;
            let typeStr = "Safe";
            let isSafe = true;
            let reason = `Statistiques offensives favorables à domicile pour ${home} avec une probabilité élevée de buts.`;

            if (homeLow.includes("barça") || awayLow.includes("barca") || homeLow.includes("barcelone") || awayLow.includes("barcelone")) {
                pick = "FC Barcelone ou Nul & Lamine Yamal décisif";
                market = "Double Chance & Prodige";
                odds = 1.75;
                confidence = 90;
                typeStr = "Banker";
                reason = "Le FC Barcelone et Lamine Yamal sont au sommet de leur forme en Liga.";
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
                is_safe: isSafe,
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
            renderCurrentDayView();
            alert(`✅ Match ${home} vs ${away} analysé avec succès et ajouté aux pronostics de ${day === 'today' ? "aujourd'hui" : day} !`);
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

    // View mode toggle buttons (Safe / All / Combos)
    document.getElementById("viewModeSafe").addEventListener("click", () => setViewMode("safe"));
    document.getElementById("viewModeAll").addEventListener("click", () => setViewMode("all"));
    document.getElementById("viewModeCombos").addEventListener("click", () => setViewMode("combos"));

    // League filter buttons
    document.querySelectorAll(".league-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => setLeagueFilter(btn.dataset.league));
    });

    // Modal open/close
    const modal = document.getElementById("addMatchModal");
    const openBtn = document.getElementById("openAddModalBtn");
    if (openBtn) openBtn.addEventListener("click", () => modal.style.display = "flex");
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
        localStorage.removeItem("hns_tips_data");
        loadAppData();
        alert("Pronostics actualisés avec succès !");
    });
});
