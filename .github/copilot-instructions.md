# Copilot Instructions

## Tech Stack
- List the technologies used in the project.

## Build Commands
- Provide the commands needed to build the project.

## Project Structure
- Describe the structure of the project, including key directories.

## Code Conventions
- Outline the coding standards and conventions followed in the project.

## Key Systems
- Detail the key systems in the application.

## CI/CD Pipeline
- Explain how the continuous integration and deployment processes are structured.

## Security Guidelines
- List the security measures and best practices to follow.

## Contribution Guidelines
- Provide guidelines for contributing to the project.

## Debugging Tips
- Offer tips for debugging issues within the application.

## Key Documentation
- Reference essential documentation related to the project.

## Onboarding Flow Architecture
1. **Registration**: New users register their accounts.
2. **Personality Test**: Users complete a personality test.
3. **Essential Data**: Users submit essential information.
4. **Extended Data**: Users provide additional information for better matching.
5. **Guide**: Users are guided to their personalized experience.

## Onboarding Data Model
- **hasCompletedRegistration**: Boolean to check if registration is complete.
- **hasSeenGuide**: Boolean to track if the user has viewed the guide.
- **hasCompletedInterestsCarousel**: Boolean to monitor completion of the interests carousel.
- **assessment_sessions**: Table to track user sessions for assessment.
- **registration_sessions**: Table to monitor user registration sessions.
- **user_interests**: Table for storing user interests.

## Updated Matching Algorithm
The matching algorithm now uses a **7-dimension weighted scoring system**:
- **Chemistry**: 30%
- **Interest**: 30%
- **Language**: 15%
- **Preference**: 15%
- **Hometown**: 5%
- **Background**: 5%

## Attendee Card System
The AttendeePreviewCard component includes:
- **Flip Animation**: For a smooth user experience.
- **Privacy Controls**: Settings to manage user visibility and information sharing.

## Connection Points System (契合点系统)
This system utilizes rarity-based scoring:
- **Rarity**: Categories include common, rare, and epic.
- **Quality Tiers**: Different quality levels based on user data and matching.
- **generateSparkPredictions**: Function to generate predictions based on user matches.

## Recent Major Changes
- Onboarding redesign to streamline the user experience.
- Interests carousel for enhanced user engagement.
- Guide persistence to maintain user orientation.
- Updates to the matching algorithm for improved accuracy.

**Note**: Ensure to follow the existing formatting style and professional tone throughout the document.