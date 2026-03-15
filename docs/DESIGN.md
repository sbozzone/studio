# Software Design Document: DinnerTime

## 1. Technical Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (via ShadCN)
- **Icons**: Lucide React
- **Persistence**: Browser `localStorage`

## 2. Architecture & Data Flow

### Data Models (`src/types/index.ts`)
- **Item**: Represents a food item (`entree` or `side`). Includes `id`, `name`, and `type`.
- **DayPlanData**: Represents a single day's dinner slot (1 entree, 2 sides, and a text note).
- **WeeklyPlan**: A map where keys are `DayOfWeek` and values are `DayPlanData`.
- **ManualGroceryItem**: User-added items for the shopping list not tied to a specific meal.

### State Management
The `DinnerTimePage` (`src/app/page.tsx`) acts as the "Single Source of Truth." It handles:
1.  Loading data from `localStorage` on mount.
2.  Orchestrating updates between the `WeeklyPlannerGrid`, `ItemListDisplay`, and `ShoppingList`.
3.  Syncing all changes back to `localStorage` via `useEffect` hooks.

## 3. Key Features & Implementation Logic

### Dynamic Day Rotation
The planner does not always start on Monday. The `getRotatedDays` utility calculates the current day and reorders the display array so the "Current Day" is always the first card in the grid.

### Smart Item Selectors
The `DayCard` component includes "Screw It, let's eat out!" and "I'm Feeling Lucky" (randomizer) options. These provide a better user experience than standard dropdowns.

### Print & Export
- **Print Engine**: Uses a robust set of `@media print` CSS rules in `globals.css`. It hides UI elements (buttons, sidebars) and optimizes cards for a clean paper layout.
- **Export**: Generates a formatted `.txt` file directly in the browser using a `Blob` and a temporary download link.

### Bulk Import
Users can upload a `.csv` file in the settings. The logic (`item-csv-upload-form.tsx`) handles header detection and default type assignment (`entree`) for single-column lists.

## 4. UI/UX Design
- **Typography**: `Belleza` (Headline) for a clean, sophisticated look; `Alegreya` (Body) for high readability.
- **Color Palette**: Warm Coral (`--primary`) for action items and Muted Olive (`--accent`) for secondary highlights, creating a "Kitchen/Culinary" feel.
- **Responsive Design**: Uses a mobile-first approach with a sidebar that stacks on smaller screens.
