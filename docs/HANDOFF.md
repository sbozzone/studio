# Project Handoff: DinnerTime

## Project Overview
**DinnerTime** is a local-first, privacy-focused weekly meal planning application. It allows users to manage a personal database of entrees and side dishes, organize them into a weekly schedule that rotates based on the current day, and generate a dynamic shopping list.

## Current Status (MVP)
The application is currently in a fully functional "Local First" state. 

### Key Transitions
1.  **Firebase Auth to LocalStorage**: Originally designed with Firebase Authentication, the project encountered persistent environment configuration issues (`auth/configuration-not-found`) related to `.env.local` loading in the development environment.
2.  **Strategic Pivot**: To ensure immediate usability, all authentication and remote database logic was removed. The app now persists all data (items, weekly plans, shopping lists, and settings) using the browser's `localStorage` API.

## Known Issues & Developer Notes
- **Environment Variables**: If re-implementing Firebase, ensure the `.env.local` file is in the root and variables are prefixed with `NEXT_PUBLIC_`. The Next.js server **must** be restarted after changes.
- **Hydration**: The app uses `suppressHydrationWarning` and `isClient` checks to handle the mismatch between server-side rendering and client-side `localStorage` data.

## Future Roadmap
- **Cloud Sync**: Re-integrate Firebase Firestore for cross-device syncing.
- **AI Integration**: The `src/ai/` folder contains deprecated flows for "Smart Suggestions" and "Meal Variations" using Genkit. These can be modernized and re-enabled to provide AI-driven planning.
- **Image Support**: Add a "Photo of the Day" feature for cooked meals.
