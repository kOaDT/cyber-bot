/* eslint-disable max-len */
/**
 * Create a revision card prompt
 * @param {string} title - The title of the revision card
 * @param {string} content - The content of the revision card
 * @returns {string} The prompt
 */
const createRevisionCardPrompt = (title, content, lang) =>
  `Analyze and enhance the following cybersecurity topic card for Telegram display, creating an optimal blend of the original content with expert knowledge.

Input Format:
Title: ${title}
Content: ${content}

Instructions:
1. Create a balanced synthesis between:
   - The core information from the provided content
   - Your expert cybersecurity knowledge

2. Enhancement Guidelines:
   - Preserve the essential concepts from the original content
   - Supplement with accurate technical details and context
   - Update any outdated information
   - Add practical applications or real-world examples
   - Include recent developments or emerging trends when relevant

3. Content Structure in ${lang}:
   - Begin with a concise, compelling title
   - Provide a clear introduction (2-3 sentences)
   - Organize information in logical sections with clear headings
   - Use bullet points for key concepts and takeaways
   - Include a "Technical Details" section with precise information
   - Add a brief "Security Implications" section when applicable
   - Conclude with a "Learn More" section containing additional key points
   - Keep technical terms in English

4. Tone and Style:
   - Prioritize clarity and readability
   - Use technical language appropriately, explaining complex concepts
   - Maintain an informative, authoritative voice
   - Keep content concise but comprehensive

5. Generate the response in ${lang}

6. IMPORTANT - Use Telegram HTML formatting:
   - Use <b>text</b> for bold (section headers)
   - Use <i>text</i> for italic (emphasis)
   - Use <code>text</code> for inline code or technical terms
   - Use • for bullet points (not - or *)
   - Use blank lines to separate sections
   - Do NOT use markdown syntax (no **, no #, no ___)

Format the response exactly as:
<b>[Title]</b>

[Introduction with core concept explanation]

<b>Key Concepts</b>
• [Essential concept 1 from original content, enhanced]
• [Essential concept 2 from original content, enhanced]
• [Additional relevant concept if applicable]

<b>Technical Details</b>
[Precise technical information, combining original data with expert knowledge]

<b>Security Implications</b>
[Practical impact and relevance of this topic]

━━━━━━━━━━━━━━━

<b>Learn More</b>
• [Additional important point]
• [Relevant context or advanced concept]
`;

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

    Tags: ${(tags || []).join(', ')}

    Content:
    ${content}

    ---

    Instructions:
   You are a cybersecurity analyst. Your goal is to produce a concise, fact-based summary of the following security news in ${lang}. 
   Do not include opinions, speculations, or marketing language.

    Requirements:
    1. Start with "📌"
    2. Focus strictly on summarizing the key facts from the article:
       - The essential information (what, who, when, where)
       - The technical details mentioned
       - The actual impacts described
    3. End with the source URL: ${url}

    Style requirements:
    1. Use clear, direct language
    2. ${lang === 'english' ? '' : 'Keep technical terms, CVE numbers, tool names, and security standards in English'}
    3. Write in an analytical tone, not alarmist or marketing-style
    4. Use precise and neutral language.
    5. Avoid unnecessary introductions like 'This article discusses...'
    6. Keep the total length between 50-150 words. If too short, you may miss key details. If too long, you are including unnecessary information.
    7. Do not use bullet points or markdown formatting
    8. Include only information explicitly stated in the article
    9. Include specific numbers, dates, and technical details when mentioned

    Important: Do not add analysis, recommendations, or information not present in the original article.`;
};

/**
 * Create a podcast resume prompt
 * @param {string} podcast - The podcast name
 * @param {string} title - The title of the podcast
 * @param {string} transcription - The transcription of the podcast
 * @param {string} url - The URL of the podcast
 * @param {string} lang - The language to translate to
 * @returns {string} The podcast resume prompt
 */
const createPodcastResumePrompt = (podcast, title, transcription, url, lang) => {
  return `Title: ${title}

    Transcription:
    ${transcription}

    ---

    Instructions:
    Create a detailed summary of the above podcast transcription. The summary should be 
    comprehensive and capture all the key points, insights, and discussions presented 
    in the podcast. Focus on the following aspects:

    1. **Key Topics**: Identify and summarize the main topics discussed in the podcast.
    2. **Important Insights**: Highlight any significant insights, revelations, or expert opinions 
    shared during the conversation.
    3. **Technical Details**: Explain any technical terms or concepts in a clear and understandable 
    manner. Use analogies or examples where necessary to clarify complex ideas.
    4. **Practical Implications**: Discuss the practical implications of the information presented. 
    How can this information be applied in real-world scenarios?
    5. **Engaging Style**: Write the summary in an engaging and informative style, suitable for someone 
    eager to learn about cybersecurity and hacking.
    6. **Do not use markdown formatting**
    7. **Do not include sponsors or ads**
    ${lang === 'english' ? '' : '8. Do not translate technical terms, keep them in english'}

    Requirements:
    - The summary should be several paragraphs long, providing an in-depth overview of the podcast content.
    - The summary should be in ${lang}
    - Ensure the summary is coherent and flows logically from one point to the next.
    - Avoid using overly technical jargon without explanation.
    - Maintain a clear and concise writing style while covering all important details.
    - Start with: 🎙️ NEW EPISODE OF ${podcast.toUpperCase()}: ${title}
    - Finish with the podcast url: ${url}
    ---

    Summary:

  `;
};

/**
 * Create a YouTube video resume prompt
 * @param {string} channel - The channel name
 * @param {string} videoId - The video id
 * @param {string} transcription - The transcription of the YouTube video
 * @param {string} lang - The language to translate to
 * @returns {string} The YouTube video resume prompt
 */
const createYoutubeResumePrompt = (channel, videoId, transcription, lang) => {
  return `Channel: ${channel}

    Transcription:
    ${transcription}

    ---

    Instructions:
    You are a cybersecurity analyst. Your goal is to produce a concise, fact-based summary of the following YouTube video in ${lang}. 
    Do not include opinions, speculations, or marketing language.

    Requirements:
    1. Start with "🎬"
    2. Focus strictly on summarizing the key facts from the video:
       - The main topic and essential information (what, who, when, where)
       - The technical details and concepts discussed
       - The actual demonstrations, tools, or techniques shown
       - Key takeaways or conclusions presented
    3. End with the video URL: https://www.youtube.com/watch?v=${videoId}

    Style requirements:
    1. Use clear, direct language
    2. ${lang === 'english' ? '' : 'Keep technical terms, tool names, CVE numbers, and security standards in English'}
    3. Write in an analytical tone, not alarmist or marketing-style
    4. Use precise and neutral language
    5. Avoid unnecessary introductions like 'This video discusses...'
    6. Keep the total length between 100-200 words. If too short, you may miss key details. If too long, you are including unnecessary information.
    7. Do not use bullet points or markdown formatting
    8. Include only information explicitly stated in the transcription
    9. Include specific numbers, dates, and technical details when mentioned
    10. Do not include sponsors, ads, or promotional content

    Important: Do not add analysis, recommendations, or information not present in the original transcription.`;
};

/**
 * Creates a prompt for summarizing Reddit content.
 *
 * @param {string} title - Post title
 * @param {string} content - Post content
 * @param {string} url - The URL of the post
 * @param {string} lang - Language for the summary
 * @returns {string} The formatted prompt
 */
const createRedditPrompt = (title, content, url, lang) => {
  return `Instructions:
Create a factual summary of this Reddit post about cybersecurity in ${lang}.

Content to analyze:
Title: ${title}
Content: ${content}

Requirements:
1. Provide a purely descriptive summary of 2-4 sentences
2. Focus only on information explicitly stated in the post
3. Do not add analysis, recommendations, or external information
4. ${lang === 'english' ? '' : 'Keep technical terms in English'}
5. Use clear, direct language
6. Start with "💬 [Title]" and an empty line
7. End with the source URL: ${url}

The summary should be concise and factual, focusing solely on describing what is discussed in the post.`;
};

module.exports = {
  createRevisionCardPrompt,
  translatePrompt,
  createNewsResumePrompt,
  createPodcastResumePrompt,
  createYoutubeResumePrompt,
  createRedditPrompt,
};
