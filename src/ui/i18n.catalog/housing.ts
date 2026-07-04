// i18n source catalog - Housing (English values).
// Part of src/ui/i18n.catalog/; assembled into `en` by ./index.ts.
// Translations live in src/ui/i18n.locales/<lang>.ts, never here.

const housingStringsEn = {
  housingUi: {
    claimedBanner: 'You claim this plot as your home.',
    ownerBanner: "This is {name}'s homestead.",
    window: {
      title: 'Your Homestead',
      close: 'Close homestead',
      slotEmpty: 'Empty',
      clear: 'Clear',
      clearAria: 'Clear slot {slot}',
      placeAria: 'Place {decor} in slot {slot}',
      hint: 'Choose a decoration for each slot.',
    },
    decor: {
      planter: 'Planter',
      lantern: 'Lantern',
      crate: 'Crate',
      bench: 'Bench',
      stool: 'Stool',
    },
  },
};

export const housingStrings = { en: housingStringsEn };
