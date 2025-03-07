# Encounter Navigation Documentation

## Overview

This document outlines the different modes and flags that can be used when navigating to the Encounter page. Understanding these options is crucial for maintaining proper workflow transitions between different sections of the application.

## Navigation Modes

The Encounter page can be accessed in different modes, which determine what functionality is available and which sections are editable. These modes are passed via the `state` object when using the `navigate` function.

### Available Modes

| Mode | Description | Editable Sections | Typical Source |
|------|-------------|-------------------|----------------|
| `create` | Create a new encounter | All sections | Manual patient creation |
| `edit` | Edit an existing encounter | All sections | Dashboard "Continue Encounter" |
| `view` | View-only mode | None | Patient history |
| `pharmacy` | Pharmacy-specific view | Disbursements only | "Review Disbursements" |
| `checkout` | Checkout-specific view | Questions only | "Complete Checkout" |

## Navigation Flags

In addition to the mode, additional flags can be passed to control the behavior of the Encounter page.

### Available Flags

| Flag | Type | Description | Example Usage |
|------|------|-------------|---------------|
| `scrollTo` | string | Automatically scrolls to a specific section | `{ scrollTo: 'questions' }` |
| `initialVitals` | object | Pre-fills vitals data | `{ initialVitals: { height: 180 } }` |

### Valid `scrollTo` Values

- `vitals` - Scrolls to the vitals section
- `subjective` - Scrolls to the subjective section
- `disbursement` - Scrolls to the disbursement section
- `questions` - Scrolls to the questions section

## Common Navigation Patterns

### From Waiting Room to Provider View

When a provider clicks "Start Encounter" in the waiting room section, the application should:

```typescript
navigate(`/encounter/${patientId}/${encounterId}`, {
  state: { 
    mode: 'edit'
  }
});
```

This opens the encounter in edit mode, allowing the provider to update all sections. The queue item status should be updated to "with_care_team" before or after this navigation.

### From Dashboard to Pharmacy Review

When a pharmacy user clicks "Review Disbursements", the application should:

```typescript
navigate(`/encounter/${patientId}/${encounterId}`, {
  state: { 
    mode: 'pharmacy',
    scrollTo: 'disbursement'
  }
});
```

This opens the encounter in pharmacy mode and automatically scrolls to the disbursement section. Only the disbursement section is editable in this mode.

### From Dashboard to Checkout

When a provider clicks "Complete Checkout" for a patient in the checkout section, the application should:

```typescript
navigate(`/encounter/${patientId}/${encounterId}`, {
  state: { 
    mode: 'checkout',
    scrollTo: 'questions'
  }
});
```

This opens the encounter in checkout mode and automatically scrolls to the questions section. Only the questions section is editable in this mode.

## Implementation Details

### Mode Detection

The Encounter component determines the current mode using the following logic:

```typescript
// Determine the mode based on location state or props
const determineMode = (): EncounterMode => {
  // Check location state first
  if (location.state?.mode) {
    return location.state.mode as EncounterMode;
  }
  
  // Fall back to props
  return initialMode;
};
```

### Queue Status Handling

The Encounter component may update the queue status based on actions taken within the encounter:

- When saving an encounter in pharmacy mode, it may update the status to "with_pharmacy"
- When completing an encounter in checkout mode, it may update the status to "completed"

## Best Practices

1. **Always specify a mode** when navigating to the Encounter page to ensure consistent behavior.
2. **Update queue status appropriately** before or after navigation to maintain workflow consistency.
3. **Use the scrollTo parameter** when you want to direct the user's attention to a specific section.
4. **Consider user roles** when determining which mode to use for navigation.

## Example: Complete Workflow

1. Patient checks in → Status: `checked_in`
2. Provider clicks "Start Encounter" → Navigate with `mode: 'edit'` → Status: `with_care_team`
3. Provider clicks "Ready for Pharmacy" → Status: `ready_pharmacy`
4. Pharmacy clicks "Review Disbursements" → Navigate with `mode: 'pharmacy', scrollTo: 'disbursement'` → Status: `with_pharmacy`
5. Provider clicks "Move to Checkout" → Status: `at_checkout`
6. Provider clicks "Complete Checkout" → Navigate with `mode: 'checkout', scrollTo: 'questions'`
7. Provider completes survey and saves → Status: `completed` 