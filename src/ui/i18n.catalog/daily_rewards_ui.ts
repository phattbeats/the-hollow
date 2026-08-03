// i18n source catalog - Daily Rewards window (English values, PHAA-660).
// Part of src/ui/i18n.catalog/; assembled into `en` by ./index.ts.
// Translations live in src/ui/i18n.locales/<lang>.ts, never here.

const dailyRewardsUiStringsEn = {
  dailyRewardsUi: {
    menuButton: 'Daily Rewards',
    window: {
      title: 'Daily Rewards',
      close: 'Close daily rewards',
      claim: 'Claim',
      claimAria: "Claim today's reward",
      claimed: 'Claimed. Come back tomorrow.',
      locked: 'Daily rewards are unavailable on this account right now.',
      hint: 'One reward per day. Missing a day never costs you anything.',
    },
    cell: {
      today: 'Today',
      itemCount: '{count}x {item}',
    },
  },
};

export const dailyRewardsUiStrings = { en: dailyRewardsUiStringsEn };
