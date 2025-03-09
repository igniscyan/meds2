# Team Assignment System

## Overview

The Team Assignment System allows for efficient distribution of patients across different care teams. This document details how team assignments work, configuration options, and best practices for managing patient flow.

## Team Types

The system supports multiple types of teams:

1. **Standard Care Teams**: Numbered teams (1-n) for general patient care
2. **Specialized Teams**: 
   - **Gyn Team**: For gynecological care
   - **Optometry Team**: For vision-related care

## Configuration

Team assignments can be configured through display preferences:

- `show_care_team_assignment`: Enable/disable team assignment functionality
- `care_team_count`: Number of standard care teams available
- `show_gyn_team`: Enable/disable gynecology team
- `show_optometry_team`: Enable/disable optometry team

These settings can be adjusted based on clinic staffing and specialization needs.

## Assignment Process

### Initial Assignment

Patients can be assigned to teams at any point in their journey, but typically:

1. During check-in process
2. While in the waiting room
3. When being triaged

### Changing Assignments

Team assignments can be changed at any time:

1. Select the patient in the dashboard
2. Use the team dropdown to select a new team
3. The change takes effect immediately
4. The patient remains in their current status

### Implementation Details

When a team assignment is changed:

1. The `intended_provider` field is updated
2. The queue item's `updated` timestamp is refreshed
3. No status change occurs
4. The UI updates to reflect the new assignment

## Queue Filtering

The dashboard supports filtering by team:

- **All Teams**: Shows all patients
- **Specific Team**: Shows only patients assigned to that team

This allows providers to focus on their assigned patients while administrators can maintain an overview of all patients.

## Best Practices

### Workload Distribution

- **Balance patient load** across teams to prevent bottlenecks
- **Consider complexity** when assigning patients
- **Monitor team queues** for imbalances

### Specialization

- **Assign to specialized teams** based on patient needs
- **Reserve specialized teams** for appropriate cases
- **Cross-train teams** to handle overflow

### Workflow Optimization

- **Assign early** in the patient journey
- **Maintain consistency** in assignments
- **Avoid frequent reassignments** unless necessary

### Team Management

- **Adjust team count** based on staffing levels
- **Enable/disable specialized teams** as needed
- **Consider geographic layout** of the clinic

## Technical Considerations

### Database Structure

Team assignments are stored in the `intended_provider` field of queue items:

- Standard teams: `team1`, `team2`, etc.
- Specialized teams: `gyn_team`, `optometry_team`
- Unassigned: empty string

### Performance

- Team assignment changes are lightweight operations
- Filtering by team is optimized for quick response
- Real-time updates ensure all users see current assignments

## Integration with Other Systems

Team assignments integrate with:

- **Queue Management**: Preserves assignments across status changes
- **Analytics**: Tracks patient distribution and wait times by team
- **Encounter System**: Provides context for patient care

## Troubleshooting

Common issues and solutions:

1. **Missing team options**: Check display preferences configuration
2. **Assignment not saving**: Verify network connectivity
3. **Patients not appearing in filtered view**: Confirm correct team selection

## Future Enhancements

Potential improvements to the team assignment system:

1. **Auto-assignment** based on patient needs
2. **Team capacity limits** to prevent overloading
3. **Provider-specific assignments** within teams
4. **Skill-based routing** for specialized care 