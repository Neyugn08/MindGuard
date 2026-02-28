(function signalDetect() {
    const DARK_PATTERN_SIGNALS = {
        // Urgency
        urgency: [
            /only\s+\d+\s+left/i,
            /limited\s+time/i,
            /expires?\s+in/i,
            /hurry[,!]/i,
            /act\s+now/i,
            /today\s+only/i,
            /\d+\s+people\s+viewing/i,
            /selling\s+fast/i,
            /almost\s+gone/i,
            /last\s+chance/i,
            /flash\s+sale/i
        ],
        // Confirm-shaming 
        confirm_shaming: [
            /no\s+thanks,?\s+i\s+don'?t\s+want/i,
            /no\s+thanks,?\s+i\s+prefer/i,
            /i\s+don'?t\s+want\s+to\s+(save|learn|improve|grow|succeed)/i,
            /skip\s+and\s+miss/i,
            /i\s+hate\s+(saving|deals|offers)/i,
            /continue\s+without\s+(protection|benefits)/i
        ],
        // Hidden costs
        hidden_costs: [
            /\+\s*fees?/i,
            /additional\s+charges/i,
            /taxes?\s+not\s+included/i,
            /processing\s+fee/i,
            /\*\s*see\s+terms/i
        ],
        // Dark GDPR patterns
        privacy_dark: [
            /accept\s+all\s+cookies/i,
            /i\s+agree\s+to\s+(all|tracking|advertising)/i,
            /personalized\s+ads/i,
            /allow\s+partners/i
        ]
    };
    // Detect autoplay video
    function detectAutoplay() {
        // Separate muted videos as they are less aggressive
        const autoplayVideos = Array.from(document.querySelectorAll("video[autoplay]")).filter(v => !v.muted); 
        const mutedAutoplay = Array.from(document.querySelectorAll("video[autoplay][muted]"));
        return autoplayVideos.length > 0
            ? {type: "autoplay_video", confidence: 0.95, count: autoplayVideos.length}
            : mutedAutoplay.length > 0
            ? {type: "autoplay_muted", confidence: 0.35, count: mutedAutoplay.length}
            : null;
    }
    // Detect pre-checked opt-ins
    function detectPreCheckedOptins() {
        const checked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked')).filter(el => {
            const label = el.closest("label") || document.querySelector(`label[for="${el.id}"]`);
            const text  = (label?.textContent || "").toLowerCase();
            // Only flag if label text looks like a consent/marketing opt-in
            return /newsletter|marketing|offer|partner|update|email/i.test(text);
        });
        return checked.length > 0 ? {type: "prechecked_optin", confidence: 0.80, count: checked.length} : null;
    }
    // Detect dark gdpr patterns
    function detectCookieBanner() {
        const bannerSelectors = [
            '[class*="cookie"]', '[id*="cookie"]',
            '[class*="consent"]', '[id*="consent"]',
            '[class*="gdpr"]', '[id*="gdpr"]', '[aria-label*="cookie" i]'
        ];
        const banner = document.querySelector(bannerSelectors.join(","));
        if (!banner) return null;
        const bannerText = banner.textContent.toLowerCase();
        if (!/cookie|consent|gdpr|privacy/i.test(bannerText)) return null;
        // Look for visible decline button
        let hasRejectBtn = false;
        if (banner.querySelector('button, a, [role="button"]')) {
            hasRejectBtn = Array.from(banner.querySelectorAll('button, a, [role="button"]')).some(b => /reject|decline|refuse|necessary only/i.test(b.textContent));
        }
        return {
            type: hasRejectBtn ? "cookie_normal" : "cookie_dark",
            confidence: hasRejectBtn ? 0.30 : 0.95,
            hasClearReject: hasRejectBtn
        };
    }
    function detectTextPatterns() {
        let signals = [];
        const elements = document.querySelectorAll("a, button, [role='button'], label, h1, h2, h3, p, span, div.cta, div.banner");
        for (const element of elements) {
            text = element.textContent || "";
            if (text.length > 200) continue;
            for (const [pattern, regexList] of Object.entries(DARK_PATTERN_SIGNALS)) {
                for (const regex of regexList) {
                    if (regex.test(text)) {
                        signals.push({
                            type: pattern,
                            confidence: 0.80,
                            text: text
                        });
                        break;
                    }
                }
            }
        }
        return signals;
    }
    function sendSignals() {
        let signals = [];
        const autoPlay = detectAutoplay();
        if (autoPlay) signals.push(autoPlay);
        const preCheckedOptins = detectPreCheckedOptins();
        if (preCheckedOptins) signals.push(preCheckedOptins);
        const cookieBanner = detectCookieBanner();
        if (cookieBanner) signals.push(cookieBanner);
        const textPatterns = detectTextPatterns();
        signals.push(...textPatterns);
        if (signals.length === 0) return; 
        chrome.runtime.sendMessage({
            type: "UI_signals",
            payload: {
                url: location.href,
                domain: location.hostname,
                signals,
                timestamp: Date.now()
            }
        });
    }
    // Run the signal detection
    sendSignals();
})();