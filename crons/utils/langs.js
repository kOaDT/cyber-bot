const AUTHORIZED_LANGUAGES = process.env.AUTHORIZED_LANGUAGES?.split(',') || [
  'english',
  'french',
  'spanish',
  'german',
  'italian',
];

module.exports = { AUTHORIZED_LANGUAGES };
