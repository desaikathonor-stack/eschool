let pdfWorkerInitialized = false;

async function getPdfJs() {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfWorkerInitialized) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        pdfWorkerInitialized = true;
    }
    return pdfjsLib;
}

async function getMammoth() {
    const mammothModule = await import('mammoth');
    return mammothModule.default || mammothModule;
}

export async function extractTextFromFile(file) {
    if (!file) return '';

    try {
        const fileName = String(file.name || '').toLowerCase();
        if (fileName.endsWith('.docx')) {
            const mammoth = await getMammoth();
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return String(result.value || '').trim();
        }

        if (fileName.endsWith('.pdf')) {
            const pdfjsLib = await getPdfJs();
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = '';

            for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
                const page = await pdf.getPage(pageIndex);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ') + ' ';
            }

            return text.trim();
        }

        const plainText = await file.text();
        return plainText.trim();
    } catch (error) {
        console.error('Extraction error', error);
        return '';
    }
}

export function isPdfOrDocx(fileName) {
    const ext = String(fileName || '').split('.').pop()?.toLowerCase();
    return ext === 'pdf' || ext === 'docx';
}