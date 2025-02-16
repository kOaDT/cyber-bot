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
  4. Focus on cybersecurity/hacking aspects
  5. Use clear, engaging language suitable for Telegram
  6. Highlight the most important takeaways
  7. Explain concepts as if teaching someone eager to build a strong foundation in cybersecurity
  ${lang === 'english' ? '' : '8. Do not translate technical terms, keep them in english'}

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

    Tags: ${(tags || []).join(', ')}

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
    ${lang === 'english' ? '' : '- Do not translate technical terms, keep them in english'}
    - Follow this format:

    📌 [Summary content: Write a concise, engaging paragraph emphasizing key cybersecurity
    and hacking insights. Focus on the most critical and interesting points. Explain technical 
    terms and concepts in a clear, educational manner, using examples where possible. 
    Highlight the practical implications of the information presented.]

    💡 REMEMBER:[One synthetic sentence]

    Read more: ${url}
`;
};

/**
 * Create a podcast resume prompt
 * @param {string} title - The title of the podcast
 * @param {string} transcription - The transcription of the podcast
 * @param {string} lang - The language to translate to
 * @returns {string} The podcast resume prompt
 */
const createPodcastResumePrompt = (title, transcription, lang) => {
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
    - Start with: 🎙️ NEW EPISODE OF DARKNET DIARIES: ${title}

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
    Create a detailed summary of the above youtube video transcription. The summary should be 
    comprehensive and capture all the key points, insights, and discussions presented 
    in the video. Focus on the following aspects:

    1. **Key Topics**: Identify and summarize the main topics discussed in the video.
    2. **Important Insights**: Highlight any significant insights, revelations, or expert opinions 
    shared in the video.
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
    - The summary should be several paragraphs long, providing an in-depth overview of the video content.
    - The summary should be in ${lang}
    - Ensure the summary is coherent and flows logically from one point to the next.
    - Avoid using overly technical jargon without explanation.
    - Maintain a clear and concise writing style while covering all important details.
    - Start with: 🎬 NEW VIDEO FROM ${channel}
    - Finish with the video url: https://www.youtube.com/watch?v=${videoId}

    ---

    Summary:

  `;
};

module.exports = {
  createRevisionCardPrompt,
  translatePrompt,
  createNewsResumePrompt,
  createPodcastResumePrompt,
  createYoutubeResumePrompt,
};
