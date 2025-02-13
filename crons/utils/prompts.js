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

/**
 * Create a news resume prompt
 * @param {string} title - The title of the article
 * @param {Array} tags - The tags of the article
 * @param {string} url - The URL of the article
 * @param {string} content - The content of the article
 * @param {string} lang - The language to translate to
 * @returns {string} The news resume prompt
 */
const createNewsResumePrompt = (title, tags, url, content, lang) => {
  return `Title: ${title}

    Tags: ${tags.join(', ')}

    Content:
    ${content}

    ---

    Instructions:
    - Create a summary of the article provided
    - The summary should be in ${lang}
    - Keep the summary to one or two paragraphs maximum
    - Focus on cybersecurity/hacking aspects
    - Use clear, engaging language suitable for Telegram
    - Highlight the most important takeaways
    - Explain concepts as if teaching someone eager to build a strong foundation in cybersecurity
    - Do not use markdown formatting
    - Follow this format:

    📌 [Summary content: Write a concise, engaging paragraph emphasizing key cybersecurity
    and hacking insights. Focus on the most critical and interesting points. Explain technical 
    terms and concepts in a clear, educational manner, using examples where possible. 
    Highlight the practical implications of the information presented.]

    💡 REMEMBER:[One synthetic sentence]

    Read more: ${url}
`;
};

module.exports = {
  createRevisionCardPrompt,
  translatePrompt,
  createNewsResumePrompt,
};
