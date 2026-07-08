module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Dependabot/Renovate auto-generated bodies include long markdown links
    // (e.g. release notes URLs) that routinely exceed the default 100-char limit.
    // Only the header matters for semantic-release's version calculation.
    'body-max-line-length': [0, 'always'],
  },
};
