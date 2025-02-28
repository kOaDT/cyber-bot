/* eslint-disable max-len */
/**
 * Create a revision card prompt
 * @param {string} title - The title of the revision card
 * @param {string} content - The content of the revision card
 * @returns {string} The prompt
 */
const createRevisionCardPrompt = (title, content, lang) =>
  `You are an experienced cybersecurity educator. Your task is to analyze the provided content to understand the core topic and create a concise, educational revision card.

  Content to analyze about ${title}:
  ###
  ${content}
  ###

  Guidelines:
  1. Focus on the main theme and key concepts rather than covering all details
  2. Don't focus only on the content of the note, I want you to create a revision card with the information you think is important to remember about the topic, even if it's not in the note
  3. Keep explanations clear and concise
  4. Only include verified, accurate information
  5. Use simple language while maintaining technical accuracy
  6. Generate the card in ${lang}
  ${lang === 'english' ? '' : '7. Keep technical terms in English'}

  Required Card Format:
  🎯 TOPIC: [One-line description of the main subject]

  📊 DIFFICULTY: [Beginner/Intermediate/Advanced]

  💡 CORE CONCEPT:
  [2-3 sentences explaining the fundamental idea]

  📚 DETAILED EXPLANATION:
  • [Key point 1]
  • [Key point 2]
  • [Key point 3]

  💻 PRACTICAL EXAMPLE:
  [A clear, specific example showing how this is used]

  🌍 REAL-WORLD APPLICATION:
  [If relevant, one concrete real-world scenario where this applies]

  ⭐ KEY TAKEAWAYS:
  • [Point 1]
  • [Point 2]
  • [Point 3]

  Keep the entire card concise and focused. The goal is to create a quick reference that captures the essence of the topic in an easily digestible format.`;

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
    You are an experienced cybersecurity analyst tasked with creating a clear, factual and impactful summary of this security news in ${lang}.

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
    4. Keep the total length between 50-150 words, it's very important that it shouldn't be too long
    5. Do not use bullet points or markdown formatting
    6. Include only information explicitly stated in the article
    7. Include specific numbers, dates, and technical details when mentioned

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
