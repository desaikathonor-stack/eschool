import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up pdfjs worker (for older versions, it might be different, but for 5.x it's usually this)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Checks if a filename has a .pdf or .docx extension.
 * @param {string} fileName 
 * @returns {boolean}
 */
export const isPdfOrDocx = (fileName) => {
    if (!fileName) return false;
    const lower = fileName.toLowerCase();
    return lower.endsWith('.pdf') || lower.endsWith('.docx');
};

/**
 * Extracts raw text from a File object (.pdf or .docx).
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const extractTextFromFile = async (file) => {
    if (!file) return '';
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) {
        return extractPdfText(file);
    } else if (name.endsWith('.docx')) {
        return extractDocxText(file);
    }
    return '';
};

const extractPdfText = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(' ') + '\n';
        }
        return fullText;
    } catch (err) {
        console.error('PDF extraction error:', err);
        return '';
    }
};

const extractDocxText = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || '';
    } catch (err) {
        console.error('DOCX extraction error:', err);
        return '';
    }
};
