function normalizeWords(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
}

export function calculateKeywordMatchPercentage(studentAnswer, teacherAnswer) {
    const studentWords = normalizeWords(studentAnswer);
    const teacherWords = normalizeWords(teacherAnswer);
    if (!teacherWords.length) return 0;

    const studentSet = new Set(studentWords);
    let matchCount = 0;

    teacherWords.forEach((word) => {
        if (studentSet.has(word)) {
            matchCount += 1;
        }
    });

    return (matchCount / teacherWords.length) * 100;
}