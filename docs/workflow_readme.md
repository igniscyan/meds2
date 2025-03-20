# Patient Workflow Documentation

## Overview

This document provides an overview of the patient workflow in the application, from check-in to checkout. It serves as a guide for understanding how patients move through the system and how different components interact.

## Key Components

- **Dashboard**: The main interface for managing patient flow
  - Queue management
  - Team assignments
  - Patient status tracking
  - Wait time monitoring
- **Encounter Page**: The detailed patient encounter interface
- **Queue System**: Manages patient status and transitions

## Patient Workflow Stages

1. **Check-In**: 
   - Patient arrives and is registered in the system
   - Appears in "Waiting Room" queue
   - Can be assigned to specific care teams
   - Wait time tracking begins

2. **Team Assignment (Optional)**:
   - Patients can be assigned to specific teams:
     - Care Teams (1-n)
     - Gyn Team (if enabled)
     - Optometry Team (if enabled)
   - Assignment can be changed at any time
   - Helps with patient distribution and specialization

3. **With Care Team**: 
   - Provider starts encounter
   - System uses most recent encounter from today or creates a new one
   - Patient vitals and history are tracked

4. **Ready for Pharmacy**: 
   - Provider completes examination
   - Medications are pending review

5. **With Pharmacy**: 
   - Pharmacy team reviews and prepares medications
   - Disbursements are processed

6. **At Checkout**: 
   - Final survey and documentation
   - Standard items are distributed

7. **Completed**: 
   - Visit is finished
   - Wait time calculation is finalized

## Queue Actions and Transitions

### Starting an Encounter
- **Action**: Click "Start Encounter" button
- **Result**: 
  - Checks for existing encounters from today
  - Uses most recent encounter if one exists
  - Creates new encounter only if needed
  - Updates status to "with_care_team"
  - Navigates to encounter page in edit mode
  - Preserves patient vitals history

### Team Assignment
- **Action**: Select team from dropdown
- **Result**:
  - Updates patient's assigned team
  - Maintains current status
  - Updates queue filtering

### Status Changes
Each status change includes:
- Appropriate role checks
- Queue position updates
- Wait time tracking
- Team assignment preservation

## Display Preferences

The dashboard supports several display preferences:
- Show/hide priority levels
- Enable/disable care team assignments
- Configure number of care teams
- Show/hide specialized teams (Gyn, Optometry)

## Analytics

Real-time tracking of:
- Total patients seen today
- Average wait times
- Queue lengths by status
- Team distribution

## Best Practices

1. **Team Assignment**:
   - Assign teams early in the process
   - Balance workload across teams
   - Consider specializations

2. **Queue Management**:
   - Monitor wait times
   - Use priority levels appropriately
   - Keep statuses updated

3. **Encounter Handling**:
   - Start encounters promptly
   - Complete all sections
   - Update status accurately

4. **Error Prevention**:
   - Verify patient details
   - Confirm status changes
   - Check team assignments

## Related Documentation

- [Encounter Navigation](./encounter_navigation.md): Details on encounter page modes and navigation
- [Queue Management](./queue_management.md): Detailed queue system documentation including encounter creation logic
- [Team Assignment](./team_assignment.md): Team management and assignment strategies

## Technical Notes

- Queue updates are real-time
- Team assignments persist across status changes
- Wait times are calculated continuously
- Analytics are updated automatically
- Error handling includes automatic retries
- All actions are role-protected 