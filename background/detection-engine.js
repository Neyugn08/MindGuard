export class DetectionEngine {
    constructor() {
        this.KEYWORD_WEIGHTS = {
             // Addiction design
            "streak": 0.50,
            "daily_reward": 0.50,
            "you_won": 0.60,
            "spin_to_win": 0.90,
            "loot": 0.60,
            "notification": 0.30,
            "don_t_miss": 0.70,
            // Financial manipulation
            "payout": 0.70,
            "casino": 0.90,
            "bet": 0.90,
            "loan": 0.40,
            "credit_score": 0.40,
            "apr": 0.50,
            "installment": 0.30,
            // Health misinformation
            "doctor_s_hate": 0.95,
            // Scam / phishing
            "verify_your_account": 0.60,
            "suspended": 0.40,
            "unusual_activity": 0.90,
            "your_account_has": 0.80,
            // Dark patterns (aligned with signal-detector lexicon)
            "only_left": 0.70,
            "limited_time": 0.70,
            "hurry": 0.40,
            "today_only": 0.70,
            "best_value": 0.30,
            "recommended": 0.30
        };
        // TLD risk weights 
        this.TLD_WEIGHTS = {
            ".xyz": 0.60, ".tk": 0.75, ".ml": 0.70,
            ".ga": 0.70, ".cf": 0.70, ".gq": 0.70,
            ".buzz": 0.50, ".win": 0.55, ".loan": 0.65,
            ".work": 0.45, ".click": 0.50, ".download": 0.60
        };
    }
    analyze({eventType, payload}) {
        let signals = [];
        // 1. URL analysis
        const urlSignals = this.classifyURL(payload.url, payload.domain);
        signals.push(...urlSignals);
        // 2. DOM and keyword analysis 
        if (eventType === "DOM_snapshot" && payload.bodyText) {
            const domSignals = this.analyzeDOM(payload, this.KEYWORD_WEIGHTS);
            signals.push(...domSignals);
        }
        // 3. UI Signal analysis (from signal-detector)
        if (eventType === "UI_signals" && payload.signals) {
            const uiSignals = this.analyzeUISignals(payload.signals);
            signals.push(...uiSignals);
        }
        // 4. Aggregate and classify 
        return this.aggregate(signals);
    }
    extractTLD(domain) {
        const parts = domain.split(".");
        return parts.length >= 2 ? `.${parts[parts.length - 1]}` : "";
    }
    classifyURL(url, domain) {
        let signals = [];
        // TLD risk scoring
        const tld = this.extractTLD(domain);
        if (this.TLD_WEIGHTS[tld]) {
            signals.push({
                type: "risky_tld",
                confidence: this.TLD_WEIGHTS[tld],
                source: "url_classifier",
                detail: `TLD ${tld} has fraud risk`
            });
        }
        // IP address as hostname (common in phishing)
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
            signals.push({
                type: "ip_as_hostname",
                confidence: 0.80,
                source: "url_classifier",
                detail: "Page served from raw IP address"
            });
        }
        // URL length anomaly (very long URLs often obfuscate destination)
        try {
            const parsedURL = new URL(url);
            const longQuerySafeDomains = [
                "google.com", "facebook.com", "fbcdn.net",
                "linkedin.com", "bing.com", "yahoo.com",
                "cloudflare.com", "microsoft.com", "live.com",
                "okta.com", "auth0.com", "amazon.com"
            ];
            const isSafeDomain = longQuerySafeDomains.some(d => parsedURL.hostname.endsWith(d));
            if (parsedURL.search.length > 200 && !isSafeDomain) {
                signals.push({
                    type: "long_query_string",
                    confidence: 0.50,
                    source: "url_classifier",
                    detail: `Query string length: ${parsedURL.search.length}`
                });
            }
        } catch (_) {}
        return signals;
    }
    scoreCTAs(buttons, weights) {
        if (!buttons.length) return 0;
        let totalScore = 0;
        for (const label of buttons) {
            const normalizedLabel = label.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, "_");
            // Check matches against weighted terms
            for (const [term, weight] of Object.entries(weights)) {
                if (normalizedLabel.includes(term)) {
                    totalScore += weight;
                }
            }
        }
        return Math.min(1.0, totalScore / buttons.length);
    }
    analyzeDOM(snapshot, weights) {
        let signals = []; 
        // Generate n-grams for phrase matching
        const unigrams = snapshot.bodyText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
        let bigrams = [];
        let trigrams = [];
        const l = unigrams.length;
        for (let i = 0; i < l - 1; i++) {
            bigrams.push(`${unigrams[i]}_${unigrams[i + 1]}`);
            if (i < l - 2) trigrams.push(`${unigrams[i]}_${unigrams[i + 1]}_${unigrams[i + 2]}`);
        }
        const ngrams = [...unigrams, ...bigrams, ...trigrams];
        // Score each n-gram
        let totalScore = 0;
        const matchedTerms = {};
        for (const ngram of ngrams) {
            const w = weights[ngram];
            if (w) {
                matchedTerms[ngram] = (matchedTerms[ngram] || 0) + w;
                totalScore += w;
            }
        }
        if (Object.keys(matchedTerms).length > 0) {
            // Normalize by document length to get a page-level score
            const normalizedScore = Math.min(1.0, totalScore / (l * 0.01 + 1));
            // Identify top contributing terms 
            const topTerms = Object.entries(matchedTerms).sort((a, b) => b[1] - a[1]).slice(0, 5).map((term) => term[0].replace(/_/g, " "));
            signals.push({
                type: "keyword_risk",
                confidence: normalizedScore,
                source: "dom_analyzer",
                detail: `Matched terms: ${topTerms.join(", ")}`
            });
        }
        // Analyze button labels for coercive language
        const ctaScore = this.scoreCTAs(snapshot.buttons || [], weights);
        if (ctaScore > 0.3) {
            signals.push({
                type: "coercive_cta",
                confidence: ctaScore,
                source: "dom_analyzer",
                detail: "Button text uses coercive or manipulative language"
            });
        }
        // Forms asking for sensitive data (email, phone, CC) are flags
        for (const form of snapshot.forms || []) {
            const hasEmail = form.inputTypes.includes("email");
            const hasCreditCard = form.inputTypes.includes("text") && /card|cc|credit/i.test(form.labelTexts.join(", "));
            const hasPassword = form.inputTypes.includes("password");
            const isSuspicious = (hasEmail && hasCreditCard) || (hasPassword && !hasEmail);
            if (isSuspicious) {
                signals.push({
                    type: "suspicious_form",
                    confidence: 0.65,
                    source: "dom_analyzer",
                    detail: `Form requesting: ${form.inputTypes.join(", ")}`
                });
            }
        }
        // Cross-Origin iframe signals
        const crossOriginFrames = (snapshot.iframes || []).filter(f => f.crossOrigin);
        if (crossOriginFrames.length > 0) {
            signals.push({
                type: "cross_origin_iframe",
                confidence: 0.60,
                source: "dom_analyzer",
                detail: `${crossOriginFrames.length} cross-origin iframes detected`
            });
        }
        return signals;
    }
    // Converts UI signals from signal-detector.js into the standard detection signal format.
    analyzeUISignals(uiSignals) {
        return uiSignals.map(s => ({
            type: s.type,
            confidence: s.confidence,
            source: "ui_signal_detector",
            detail: s.text || s.count || s.hasClearReject
        }));
    }
    signalToCategory(signalType) {
        const mapping = {
            ip_as_hostname: "phishing",
            suspicious_form: "phishing",
            autoplay_video: "addiction_design",
            urgency: "dark_pattern",
            confirm_shaming: "dark_pattern",
            hidden_costs: "dark_pattern",
            cookie_dark: "dark_pattern",
            prechecked_optin: "dark_pattern",
            coercive_cta: "dark_pattern",
            keyword_risk: "content_risk",
            risky_tld: "domain_risk"
        };
        return mapping[signalType] || "unknown";
    }
    aggregate(signals) {
        if (signals.length === 0) {
            return {risk_type: "none", confidence: 0, signals: []};
        }
        // Group signals by category
        const categoryScores = {};
        for (const signal of signals) {
            const category = this.signalToCategory(signal.type);
            // Update based on max confidence
            categoryScores[category] = Math.max(categoryScores[category] || 0, signal.confidence);
        }
        // Find the most dominant category
        const [dominantCategory, dominantScore] = Object.entries(categoryScores).sort((a, b) => b[1] - a[1])[0];
        // Overall confidence = weighted average of top 3 signals
        const sorted = signals.slice().sort((a, b) => b.confidence - a.confidence);
        const top3 = sorted.slice(0, 3);
        let avg = 0;
        for (const signal of top3) {
            avg += signal.confidence / 3;
        }
        return {
            risk_type: dominantCategory,
            confidence: Math.min(1.0, avg),
            signals
        };
    }
}