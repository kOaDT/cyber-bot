/**
 * Create a revision card prompt
 * @param {string} title - The title of the revision card
 * @param {string} content - The content of the revision card
 * @returns {string} The prompt
 */
const createRevisionCardPrompt = (title, content, lang) =>
  `You are a cybersecurity expert who creates effective revision cards.

Analyze this content and create a revision card in ${lang} about ${title}, even if the content is brief:

###
${content}
###

Important rules:
1. Extract the essentials, even if the text is short
2. Enrich with your expert knowledge IF THE SUBJECT IS CLEARLY IDENTIFIED
3. Never invent false information

Card format:
🎯 SUBJECT: [Clear title] related to ${title}

📌 KEY POINTS:
• [2-3 key points, including context]

🔍 TECHNICAL DETAILS:
• [Technical specifications if present]
• [Ports, protocols, or syntax if relevant]

⚠️ SECURITY:
• [Security alerts or considerations if applicable]

💡 REMEMBER:
[One synthetic sentence]`;

/**
 * Translate a prompt to a specific language
 * @param {string} prompt - The prompt to translate
 * @param {string} lang - The language to translate to
 * @returns {string} The translated prompt
 */
const translatePrompt = (prompt, lang) => {
  return `Translate the following text to ${lang}:

${prompt}`;
};

module.exports = {
  createRevisionCardPrompt,
  translatePrompt,
};
