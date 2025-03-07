# Patient Workflow Documentation

## Overview

This document provides an overview of the patient workflow in the application, from check-in to checkout. It serves as a guide for understanding how patients move through the system and how different components interact.

## Key Components

- **Dashboard**: The main interface for managing patient flow
- **Encounter Page**: The detailed patient encounter interface
- **Queue System**: Manages patient status and transitions

## Patient Workflow Stages

1. **Check-In**: Patient arrives and is registered in the system
2. **Waiting Room**: Patient waits to be seen by a provider
3. **With Care Team**: Patient is being seen by a provider
4. **Ready for Pharmacy**: Patient needs medications
5. **With Pharmacy**: Patient's medications are being prepared
6. **At Checkout**: Patient is completing final steps
7. **Completed**: Patient has completed their visit

## Navigation Between Stages

The application uses a combination of status updates and page navigation to move patients through the workflow. For detailed information on how navigation works, see the [Encounter Navigation Documentation](./encounter_navigation.md).

### Key Transitions

- **Waiting Room → With Care Team**: 
  - Button: "Start Encounter"
  - Action: Updates status to "with_care_team" and navigates to Encounter page in "edit" mode

- **With Care Team → Ready for Pharmacy**: 
  - Button: "Ready for Pharmacy"
  - Action: Updates status to "ready_pharmacy"

- **Ready for Pharmacy → With Pharmacy**: 
  - Button: "Review Disbursements"
  - Action: Updates status to "with_pharmacy" and navigates to Encounter page in "pharmacy" mode

- **Ready for Pharmacy/With Pharmacy → At Checkout**: 
  - Button: "Move to Checkout"
  - Action: Updates status to "at_checkout"

- **At Checkout → Completed**: 
  - Button: "Complete Checkout"
  - Action: Navigates to Encounter page in "checkout" mode
  - Final Step: Saving the encounter completes the process and updates status to "completed"

## Status Flags and UI States

Each status has associated UI elements and permissions:

- **checked_in**: Visible in Waiting Room, can be assigned to teams
- **with_care_team**: Visible in With Care Team, encounter is editable
- **ready_pharmacy**: Visible in Ready for Pharmacy, can be reviewed by pharmacy
- **with_pharmacy**: Visible in With Pharmacy, medications being processed
- **at_checkout**: Visible in At Checkout, survey can be completed
- **completed**: No longer visible in active queues

## Related Documentation

- [Encounter Navigation Documentation](./encounter_navigation.md): Detailed information on navigation modes and flags
- [Disbursement System Optimization](./readme.md): Information about the medication disbursement system
- [Disbursement Implementation](./disbursement_implementation.md): Details on the implementation of the disbursement system

## Best Practices

1. **Status Consistency**: Ensure queue status is always in sync with the current view
2. **Clear Navigation**: Use appropriate navigation modes when moving between pages
3. **Role-Based Access**: Respect role permissions for different actions
4. **Error Handling**: Provide clear feedback when transitions fail 