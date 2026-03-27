async function getMistral() {
  const { Mistral } = await import('@mistralai/mistralai');
  return Mistral;
}

module.exports = { getMistral };
