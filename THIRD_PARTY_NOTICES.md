# Third Party Notices

This project's original code is proprietary; see `LICENSE`. It is a fork of
World of ClaudeCraft, originally released under the MIT License by Levy
Street; see `NOTICE` for the retained upstream copyright and license text.
Bundled art asset credits are tracked separately in `CREDITS.md`.

This file records third-party *runtime dependency* notices beyond what a
standard MIT/permissive `package-lock.json` graph implies — i.e. dependencies
whose license terms require reproducing a notice beyond simple attribution.

As of the wallet strip (2026-07-01, see `FORK-NOTES.md`), the Reown AppKit /
WalletConnect Community-Licensed dependency stack that previously required
notices here — and the Solana wallet-adapter packages it pulled in
(`@noble/curves`, `@solana/web3.js`, `bs58`, `buffer`, etc.) — were removed
along with the feature that required them. `package.json` carries no
remaining dependency of theirs.

No current runtime dependency requires a notice beyond `package-lock.json`.
This file is retained as the place such a notice belongs if that changes.
