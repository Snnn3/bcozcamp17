# UI responsive and browser test matrix

> **PROVISIONAL — pending S0-01 approval.** The values below are a working
> baseline for Participant Web and Staff Web shell development. They are not
> the frozen decision. Reconcile this file with the confirmed viewport and
> browser list once [S0-01](https://github.com/Snnn3/bcozcamp17/issues/1) is
> approved, and remove this notice at that point.

## Viewports (CSS pixels)

| Name | Width | Represents |
|---|---|---|
| Mobile | 375 | Small phones (e.g. iPhone SE-class screens) |
| Tablet | 768 | Tablets and large phones in portrait |
| Desktop | 1280 | Laptop and desktop browser windows |

## Browsers

| Browser | Version | Notes |
|---|---|---|
| Chrome | Latest stable | Desktop and Android |
| Firefox | Latest stable | Desktop |
| Safari | Latest stable, iOS | Mobile-only; no macOS Safari runner available yet |

## How this is used

- Manual checks: resize the browser (or use device emulation) to each
  viewport width above and confirm no horizontal scrolling, overlapping
  content, or unreachable interactive elements.
- Automated checks: component tests under `tests/ui/` cover keyboard
  navigation, visible focus, and labeled controls; they do not yet assert
  pixel-level layout at each breakpoint.
- Sprint 0 gate ([S0-10](https://github.com/Snnn3/bcozcamp17/issues/10))
  expects evidence (screenshots or recorded checks) against this matrix
  before Participant/Staff shell work is considered complete.
