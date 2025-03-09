# Queue Management System

## Overview

The Queue Management System is a core component of the application that handles patient flow through different stages of care. This document details the technical implementation of queue operations, encounter creation logic, and status transitions.

## Recent Updates

- **Combined Migrations**: All database migrations have been consolidated into a single file (`1717100000_combined_migrations.go`) for easier management.
- **New Settings Option**: Added `show_move_to_checkout` preference to control visibility of the "Move to Checkout" button.
- **Encounter Creation Logic**: Fixed to use existing encounters from the same day instead of always creating new ones.
- **Team Assignment**: Improved to handle assignments without affecting status.

## Queue Item Lifecycle

A queue item represents a patient's journey through the clinic. Each queue item has the following key attributes:

- `status`: Current stage in the workflow
- `patient`: Reference to the patient record
- `encounter`: Reference to the current encounter (if any)
- `check_in_time`: When the patient was checked in
- `start_time`: When the patient started being seen
- `end_time`: When the patient's visit was completed
- `assigned_to`: Provider currently assigned to the patient
- `intended_provider`: Team assignment for the patient
- `priority`: Numerical priority level (higher = more urgent)
- `line_number`: Sequential number assigned at check-in

## Status Transitions

Queue items move through the following statuses:

1. `checked_in` → Initial status when patient arrives
2. `with_care_team` → Patient is being seen by a provider
3. `ready_pharmacy` → Patient needs medications
4. `with_pharmacy` → Medications are being prepared
5. `at_checkout` → Final steps are being completed
6. `completed` → Visit is finished

## Encounter Creation Logic

When a provider starts an encounter with a patient, the system follows this logic:

```
IF patient has an encounter from today
    Use the most recent encounter
ELSE
    Create a new encounter
    Copy patient's vitals to the new encounter
```

This approach ensures:
- Continuity of care for patients who return to the waiting room
- Proper handling of patients who visit multiple times in one day
- Preservation of patient data across the visit

### Implementation Details

The encounter creation process:

1. Retrieves the patient record
2. Gets today's date in YYYY-MM-DD format
3. Searches for encounters from today for this patient
4. If found, uses the most recent one
5. If not found, creates a new encounter with the patient's current vitals
6. Updates the queue item with the encounter reference
7. Navigates to the encounter page in edit mode

## Action Buttons

The dashboard provides various action buttons for managing patient flow. Each button is designed to perform a specific transition:

### Start Encounter
- Moves patient from `checked_in` to `with_care_team`
- Uses existing encounter from today or creates a new one
- Navigates to the encounter page in edit mode

### Continue Encounter
- Available for patients already in the system
- Uses the existing encounter
- Navigates to the encounter page in edit mode

### Review Disbursements
- Moves patient from `ready_pharmacy` to `with_pharmacy`
- Uses the existing encounter
- Navigates to the encounter page in pharmacy mode

### Move to Checkout
- Moves patient from `ready_pharmacy` or `with_pharmacy` to `at_checkout`
- Uses the existing encounter
- Can be enabled/disabled via display preferences
- Only available to providers

### Complete Checkout
- Moves patient from `at_checkout` to `completed`
- Uses the existing encounter
- Navigates to the encounter page in checkout mode

## Configurable UI Elements

The dashboard UI can be customized through display preferences:

- `show_priority_dropdown`: Show/hide priority selection
- `show_care_team_assignment`: Enable/disable team assignments
- `care_team_count`: Number of care teams to display
- `show_gyn_team`: Show/hide gynecology team option
- `show_optometry_team`: Show/hide optometry team option
- `show_move_to_checkout`: Show/hide the "Move to Checkout" button

These preferences can be configured in the Settings page.

## Team Assignment

Patients can be assigned to specific teams:
- Care Teams (numbered 1 through n)
- Specialized teams (Gyn, Optometry)

Team assignment:
- Can be changed at any point in the workflow
- Is preserved across status transitions
- Helps with workload distribution and specialization

## Queue Sorting Logic

Queue items are sorted in the following order:

1. Priority (highest to lowest)
2. Line number (lowest to highest)
3. Check-in time (earliest to latest)

This ensures that:
- Urgent cases are handled first
- Patients are generally seen in the order they arrived
- The queue remains stable and predictable

## Wait Time Tracking

The system tracks several time metrics:
- Total wait time: From check-in to completion
- Initial wait time: From check-in to first provider contact
- Care time: Time spent with providers
- Pharmacy wait time: Time waiting for medications

These metrics are used for:
- Real-time analytics
- Identifying bottlenecks
- Improving patient experience
- Staff resource allocation

## Error Handling

The queue management system includes robust error handling:
- Automatic retries for network failures
- Validation of status transitions
- Prevention of invalid state combinations
- Clear error messages for troubleshooting

## Technical Considerations

### Database Interactions

Queue operations are designed to be:
- Atomic: Each operation completes fully or not at all
- Consistent: The database remains in a valid state
- Isolated: Concurrent operations don't interfere
- Durable: Completed operations persist even after system failures

### Performance Optimizations

- Real-time updates use efficient change subscriptions
- Batch operations for multiple queue items
- Caching of frequently accessed data
- Pagination for large queue lists

## Best Practices

1. **Status Management**:
   - Always use the appropriate action for status changes
   - Verify status transitions are valid
   - Include necessary metadata with each transition

2. **Encounter Handling**:
   - Preserve encounter continuity when possible
   - Ensure proper linking between queue items and encounters
   - Validate encounter data before saving

3. **Team Assignment**:
   - Balance workload across teams
   - Consider patient needs when assigning teams
   - Monitor team queue lengths

4. **Error Recovery**:
   - Check for and resolve stuck queue items
   - Verify queue item-encounter consistency
   - Monitor for unusual wait times 