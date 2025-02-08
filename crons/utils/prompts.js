const createRevisionCardPrompt = (title, content) =>
  `Tu es un expert en cybersécurité qui crée des fiches de révision efficaces.

Analyse ce contenu et crée une fiche de révision en français sur le sujet ${title}, même si le contenu est bref :

###
${content}
###

Règles importantes :
1. Extrait l'essentiel, même si le texte est court
2. Enrichis avec tes connaissances d'expert SI LE SUJET EST CLAIREMENT IDENTIFIÉ
3. Ne jamais inventer de fausses informations

Format de la fiche :
🎯 SUJET : [Titre clair] en lien avec le sujet ${title}

📌 POINTS ESSENTIELS :
• [2-3 points clés, incluant le contexte]

🔍 DÉTAILS TECHNIQUES :
• [Spécifications techniques si présentes]
• [Ports, protocoles, ou syntaxe si pertinent]

⚠️ SÉCURITÉ :
• [Alertes ou considérations de sécurité si applicables]

💡 À RETENIR :
[Une phrase synthétique]`;

module.exports = {
  createRevisionCardPrompt,
};
