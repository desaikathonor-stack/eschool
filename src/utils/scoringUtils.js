/**
 * Normalize text for comparison by converting to lowercase,
 * removing special characters, and trimming whitespace.
 */
function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate keyword match percentage using keyword coverage algorithm.
 * Measures how many keywords from the answer key are present in the student's answer.
 * 
 * @param {string} answer - The student's answer
 * @param {string} answerKey - The correct answer key/expected answer
 * @returns {number} Percentage match (0-100)
 */
export function calculateKeywordMatchPercentage(answer, answerKey) {
    if (!answer || !answerKey) {
        return answer === answerKey ? 100 : 0;
    }

    const ansTokens = normalizeText(answer).split(' ').filter(Boolean);
    const keyTokens = normalizeText(answerKey).split(' ').filter(Boolean);

    if (!keyTokens.length) return 0;
    if (!ansTokens.length) return 0;

    const ansSet = new Set(ansTokens);
    let hits = 0;

    for (const token of keyTokens) {
        if (ansSet.has(token)) {
            hits += 1;
        }
    }

    return (hits / keyTokens.length) * 100;
}

/**
 * Calculate match percentage using Jaccard similarity index.
 * Measures the intersection over union of keywords.
 * 
 * @param {string} answer - The student's answer
 * @param {string} answerKey - The correct answer key/expected answer
 * @returns {number} Similarity percentage (0-100)
 */
export function calculateJaccardSimilarity(answer, answerKey) {
    if (!answer || !answerKey) {
        return answer === answerKey ? 100 : 0;
    }

    const ansSet = new Set(normalizeText(answer).split(' ').filter(Boolean));
    const keySet = new Set(normalizeText(answerKey).split(' ').filter(Boolean));

    if (!keySet.size) return 0;
    if (!ansSet.size) return 0;

    let intersection = 0;
    keySet.forEach(token => {
        if (ansSet.has(token)) {
            intersection += 1;
        }
    });

    const union = new Set([...ansSet, ...keySet]).size;
    if (!union) return 0;

    return (intersection / union) * 100;
}

/**
 * Score an answer based on difficulty level and threshold.
 * 
 * @param {number} matchPercentage - The calculated match percentage (0-100)
 * @param {string} difficulty - Difficulty level: 'easy', 'medium', or 'hard'
 * @param {number} explicitTarget - Optional explicit target threshold
 * @returns {object} Object with { passed: boolean, score: number (0-1) }
 */
export function scoreAnswer(matchPercentage, difficulty = 'easy', explicitTarget = null) {
    // Determine target threshold based on difficulty
    let targetMatch = 85; // easy
    if (difficulty === 'hard') targetMatch = 75;
    else if (difficulty === 'medium') targetMatch = 80;

    // Use explicit target if provided
    if (explicitTarget && Number.isFinite(explicitTarget) && explicitTarget > 0) {
        targetMatch = Math.max(1, Math.min(100, explicitTarget));
    }

    // Determine if answer passes the threshold
    const passed = matchPercentage >= targetMatch;

    // Calculate score (0-1 scale)
    let score = 0;
    if (passed) {
        score = 1;
    } else {
        score = matchPercentage / targetMatch;
    }

    return {
        passed,
        score: Math.min(1, score),
        percentage: matchPercentage,
        threshold: targetMatch
    };
}
