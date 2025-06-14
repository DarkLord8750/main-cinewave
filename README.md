# CineWave - Movie Streaming Platform

A modern movie streaming platform built with React, TypeScript, and Supabase.

## Detailed Project Structure

```
├── node_modules/                      # Node.js dependencies
├── public/                           # Static public assets
├── src/
│   ├── components/
│   │   ├── admin/                    # Admin-specific components
│   │   │   ├── AdminHeader.tsx       # Admin dashboard header with user info and actions
│   │   │   ├── AdminSidebar.tsx      # Admin navigation sidebar with menu items
│   │   │   ├── BulkOperations.tsx    # Bulk content management operations
│   │   │   ├── ContentTable.tsx      # Content management table with CRUD operations
│   │   │   ├── DashboardStats.tsx    # Admin dashboard statistics and metrics
│   │   │   ├── SeriesForm.tsx        # Series creation/editing form with validation
│   │   │   ├── SeriesManager.tsx     # Series management interface with episodes
│   │   │   └── UserTable.tsx         # User management table with permissions
│   │   │
│   │   ├── common/                   # Shared components
│   │   │   ├── ContentCard.tsx       # Reusable content card with hover effects
│   │   │   ├── ContentRow.tsx        # Content row component for lists
│   │   │   ├── Footer.tsx            # Site footer with links and copyright
│   │   │   ├── HeroBanner.tsx        # Hero section component for landing pages
│   │   │   ├── LoadingSpinner.tsx    # Loading state indicator with animation
│   │   │   ├── Logo.tsx              # Application logo with responsive sizing
│   │   │   ├── Navbar.tsx            # Navigation bar with user menu
│   │   │   └── VideoPlayer.tsx       # Video player with controls and quality options
│   │   │
│   │   ├── navigation/               # Navigation components
│   │   │   ├── MobileNav.tsx         # Mobile navigation menu with animations
│   │   │   └── Navbar.tsx            # Main navigation component with responsive design
│   │   │
│   │   └── ui/                       # UI components
│   │       ├── button.tsx            # Button component with variants
│   │       ├── input.tsx             # Input field component with validation
│   │       ├── label.tsx             # Label component for forms
│   │       ├── textarea.tsx          # Textarea component with auto-resize
│   │       └── use-toast.ts          # Toast notification hook for alerts
│   │
│   ├── layouts/                      # Page layout components
│   │   ├── AdminLayout.tsx           # Admin section layout with sidebar
│   │   ├── AuthLayout.tsx            # Authentication pages layout
│   │   └── MainLayout.tsx            # Main application layout
│   │
│   ├── lib/                          # Library and utility functions
│   │   ├── supabase.ts              # Supabase client configuration and types
│   │   └── utils.ts                 # General utility functions
│   │
│   ├── pages/                        # Page components
│   │   ├── admin/                    # Admin pages
│   │   ├── BrowsePage.tsx            # Content browsing page with filters
│   │   ├── ForgotPasswordPage.tsx    # Password recovery page with email
│   │   ├── HomePage.tsx              # Landing page with featured content
│   │   ├── LoginPage.tsx             # User login page with validation
│   │   ├── MoviePage.tsx             # Movie details page with player
│   │   ├── NotFoundPage.tsx          # 404 error page with navigation
│   │   ├── ProfilePage.tsx           # User profile page with settings
│   │   ├── RegisterPage.tsx          # User registration page with validation
│   │   ├── ResetPasswordPage.tsx     # Password reset page with token
│   │   ├── SearchPage.tsx            # Search results page with filters
│   │   └── SeriesPage.tsx            # Series details page with episodes
│   │
│   ├── stores/                       # State management
│   │   ├── analyticsStore.ts        # Analytics state with tracking
│   │   ├── authStore.ts             # Authentication state with tokens
│   │   ├── contentStore.ts          # Content state with caching
│   │   ├── genreStore.ts            # Genre state with categories
│   │   ├── uiStore.ts               # UI state with themes
│   │   ├── userStore.ts             # User state with preferences
│   │   └── watchHistoryStore.ts     # Watch history with progress
│   │
│   ├── utils/                        # Utility functions
│   │   └── contentValidation.ts     # Content validation utilities
│   │
│   ├── App.tsx                       # Main application component with routes
│   ├── index.css                     # Global styles and Tailwind imports
│   ├── main.tsx                      # Application entry point with providers
│   └── vite-env.d.ts                 # TypeScript declarations for Vite
│
├── supabase/                         # Supabase configuration and migrations
├── .gitignore                        # Git ignore rules
├── eslint.config.js                  # ESLint configuration with rules
├── index.html                        # HTML entry point with meta tags
├── netlify.toml                      # Netlify deployment configuration
├── package.json                      # Project dependencies and scripts
├── postcss.config.js                 # PostCSS configuration for Tailwind
├── supabase-types.ts                 # Supabase TypeScript type definitions
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.app.json                 # TypeScript configuration for app
├── tsconfig.json                     # Base TypeScript configuration
├── tsconfig.node.json                # TypeScript configuration for Node
├── vercel.json                       # Vercel deployment configuration
└── vite.config.ts                    # Vite configuration with plugins
```

## Component Organization

### Admin Components
- **AdminHeader**: Dashboard header with user info, notifications, and quick actions
- **AdminSidebar**: Navigation sidebar with collapsible menu items and active state
- **BulkOperations**: Tools for managing multiple content items with batch actions
- **ContentTable**: Table for managing content with sorting, filtering, and pagination
- **DashboardStats**: Statistics and metrics display with charts and real-time updates
- **SeriesForm**: Form for creating and editing series with episode management
- **SeriesManager**: Interface for managing series content with drag-and-drop
- **UserTable**: Table for managing user accounts with role-based permissions

### Common Components
- **ContentCard**: Reusable card for displaying content with hover effects and actions
- **ContentRow**: Row component for content lists with lazy loading
- **Footer**: Site-wide footer with navigation links and social media
- **HeroBanner**: Hero section component with background video and call-to-action
- **LoadingSpinner**: Loading state indicator with customizable animation
- **Logo**: Application logo with responsive sizing and animation
- **Navbar**: Main navigation component with user menu and search
- **VideoPlayer**: Video player with quality selection, subtitles, and progress tracking

### Navigation Components
- **MobileNav**: Mobile-friendly navigation menu with animations and gestures
- **Navbar**: Main navigation component with responsive design and dropdowns

### UI Components
- **button**: Reusable button component with variants and loading states
- **input**: Form input component with validation and error states
- **label**: Form label component with required state
- **textarea**: Text area component with auto-resize and character count
- **use-toast**: Toast notification hook for success/error messages

## Layout System

### AdminLayout
- Sidebar navigation
- Header with user info
- Content area with padding
- Responsive design

### AuthLayout
- Centered content
- Logo display
- Form container
- Background styling

### MainLayout
- Navigation header
- Content wrapper
- Footer
- Responsive container

## State Management

The application uses multiple stores for state management:

### Analytics Store
- User engagement metrics
- Content popularity tracking
- View duration statistics
- User behavior analysis

### Auth Store
- User authentication state
- Token management
- Session handling
- Permission checks

### Content Store
- Content caching
- Search results
- Filtered content
- Pagination state

### Genre Store
- Genre categories
- Content categorization
- Filter options
- Navigation structure

### UI Store
- Theme preferences
- Modal states
- Loading states
- Toast notifications

### User Store
- User preferences
- Profile information
- Settings
- Watchlist

### Watch History Store
- Viewing progress
- Continue watching
- Recently watched
- Watch time tracking

## Utility Functions

### Content Validation
- Input validation
- File type checking
- Size limitations
- Format verification

## Technology Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase
- **Deployment**: Netlify/Vercel
- **Code Quality**: ESLint
- **Package Manager**: npm

## Key Features

1. **User Authentication**
   - Login/Register functionality
   - Password reset capabilities
   - User profile management
   - Role-based access control

2. **Content Browsing**
   - Home page with featured content
   - Browse page for content discovery
   - Search functionality with filters
   - Movie and Series dedicated pages
   - Genre-based navigation

3. **Admin Features**
   - Dedicated admin section
   - Content management capabilities
   - User management
   - Analytics dashboard
   - Bulk operations

4. **Responsive Design**
   - Mobile-first approach
   - Tailwind CSS for styling
   - Adaptive navigation
   - Responsive video player
   - Touch-friendly interfaces

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Development

- The project uses TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling
- Component-based architecture
- Modular file structure
- State management with stores
- Responsive design patterns

## Deployment

The project is configured for deployment on both Netlify and Vercel platforms.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## Supabase Integration

### Database Structure
The project uses Supabase as its backend service, with a comprehensive database structure managed through migrations.

### Migration Files
The database schema is managed through a series of migration files in the `supabase/migrations` directory:

```
supabase/
├── migrations/                       # Database migration files
│   ├── 20250510045652_winter_field.sql    # Initial schema setup
│   ├── 20250510054104_precious_coast.sql  # User authentication tables
│   ├── 20250510054540_purple_pebble.sql   # Content management tables
│   ├── 20250510054924_steep_water.sql     # Series and episodes structure
│   ├── 20250510055753_wispy_summit.sql    # User preferences and settings
│   ├── 20250510060018_navy_lake.sql       # Analytics tracking
│   ├── 20250510060632_quick_voice.sql     # Search functionality
│   ├── 20250511071244_floral_peak.sql     # Content categorization
│   ├── 20250511071735_broad_meadow.sql    # User roles and permissions
│   ├── 20250511072514_empty_bonus.sql     # Watch history tracking
│   ├── 20250511082848_empty_jungle.sql    # Content metadata
│   ├── 20250511094455_frosty_mode.sql     # User interactions
│   ├── 20250511095500_rustic_palace.sql   # Content recommendations
│   ├── 20250511100512_little_bridge.sql   # Notification system
│   ├── 20250511100914_black_sun.sql       # Content ratings
│   ├── 20250511101218_misty_lab.sql       # User favorites
│   ├── 20250511102049_weathered_gate.sql  # Content comments
│   ├── 20250511111824_bronze_disk.sql     # User activity logs
│   ├── 20250512065735_frosty_temple.sql   # Content genres
│   ├── 20250512065920_silent_salad.sql    # Content languages
│   ├── 20250512072329_holy_unit.sql       # Content subtitles
│   ├── 20250512072526_cold_plain.sql      # Content quality options
│   ├── 20250512080821_green_field.sql     # User subscriptions
│   ├── 20250512080953_ivory_cottage.sql   # Payment processing
│   ├── 20250512081128_tight_ember.sql     # Subscription plans
│   ├── 20250512081510_withered_jungle.sql # User devices
│   ├── 20250512082431_flat_reef.sql       # Content availability
│   ├── 20250512082627_amber_garden.sql    # Content restrictions
│   ├── 20250512083217_bitter_garden.sql   # Content licensing
│   ├── 20250512083733_lingering_disk.sql  # Content distribution
│   ├── 20250512083956_solitary_spark.sql  # Content scheduling
│   ├── 20250512084139_ivory_tree.sql      # Content promotions
│   ├── 20250512084238_twilight_cave.sql   # User notifications
│   ├── 20250512084343_curly_waterfall.sql # Content playlists
│   ├── 20250512084511_fancy_moon.sql      # User playlists
│   ├── 20250512084853_dark_mud.sql        # Content chapters
│   ├── 20250512085321_broad_trail.sql     # Content thumbnails
│   ├── 20250512085558_purple_sea.sql      # Content trailers
│   ├── 20250512085714_scarlet_cliff.sql   # Content extras
│   ├── 20250512090041_sparkling_forest.sql# Content related items
│   ├── 20250512090314_icy_pond.sql        # Content cast
│   ├── 20250512090440_dusty_mouse.sql     # Content crew
│   ├── 20250512090641_polished_paper.sql  # Content awards
│   ├── 20250512090742_frosty_surf.sql     # Content reviews
│   ├── 20250512090931_emerald_tree.sql    # Content recommendations
│   ├── 20250512091358_damp_crystal.sql    # User recommendations
│   ├── 20250512091625_tiny_manor.sql      # Content analytics
│   ├── 20250512092239_graceful_bonus.sql  # User analytics
│   ├── 20250512102744_polished_gate.sql   # Content search optimization
│   ├── 20250512103146_cool_harbor.sql     # User search history
│   ├── 20250512103452_graceful_prism.sql  # Content metadata optimization
│   ├── 20250512103645_lively_haze.sql     # User preferences optimization
│   ├── 20250512104456_shiny_pond.sql      # Content delivery optimization
│   ├── 20250512104744_misty_bread.sql     # User experience optimization
│   ├── 20250512104945_remove_duration.sql # Performance optimization
│   ├── 20250512105000_fix_series_creation.sql # Series creation fixes
│   ├── 20250512105100_fix_series_not_found.sql # Series not found fixes
│   └── 20250514000000_add_profile_id_to_profile_avatars.sql # Profile avatar fixes
```

### Key Database Features

1. **User Management**
   - Authentication and authorization
   - User profiles and preferences
   - Role-based access control
   - User activity tracking

2. **Content Management**
   - Movie and series storage
   - Episode management
   - Content metadata
   - Content categorization

3. **Media Features**
   - Video quality options
   - Subtitle support
   - Content availability
   - Content restrictions

4. **User Experience**
   - Watch history
   - Favorites and playlists
   - Content recommendations
   - User notifications

5. **Analytics and Tracking**
   - User engagement metrics
   - Content popularity
   - View duration statistics
   - User behavior analysis

6. **Subscription Management**
   - Subscription plans
   - Payment processing
   - User devices
   - Content licensing

7. **Search and Discovery**
   - Content search optimization
   - User search history
   - Content recommendations
   - Related content

8. **Content Enhancement**
   - Cast and crew information
   - Awards and reviews
   - Content extras
   - Trailers and thumbnails

### Database Optimization
- Indexed search fields
- Optimized content delivery
- Efficient user preferences
- Performance improvements

### Security Features
- Row Level Security (RLS)
- User authentication
- Content access control
- Data encryption

## Admin Section

### Admin Pages Structure
```
src/pages/admin/
├── analytics.tsx           # Analytics dashboard with metrics and charts
├── Content.tsx            # Content management interface
├── Dashboard.tsx          # Main admin dashboard
└── Users.tsx              # User management interface
```

### Admin Features

1. **Dashboard (Dashboard.tsx)**
   - Overview of platform statistics
   - Quick access to key metrics
   - Recent activity monitoring
   - System status indicators
   - Performance metrics
   - User engagement overview

2. **Content Management (Content.tsx)**
   - Movie and series management
   - Content upload and editing
   - Metadata management
   - Content categorization
   - Episode management
   - Content scheduling
   - Quality control
   - Bulk operations
   - Content status tracking
   - Version control

3. **User Management (Users.tsx)**
   - User account management
   - Role assignment
   - Permission control
   - User activity monitoring
   - Account status management
   - User preferences
   - Subscription management
   - User support tools
   - Account verification
   - User analytics

4. **Analytics (analytics.tsx)**
   - User engagement metrics
   - Content performance
   - Viewing statistics
   - Revenue analytics
   - User behavior analysis
   - Content popularity
   - Platform usage patterns
   - Performance metrics
   - Growth indicators
   - Custom reports

### Admin Components Integration

The admin section utilizes several specialized components:

1. **AdminHeader**
   - Navigation controls
   - User information
   - Quick actions
   - Notifications

2. **AdminSidebar**
   - Section navigation
   - Quick access menu
   - Status indicators
   - Collapsible interface

3. **ContentTable**
   - Content listing
   - Filtering options
   - Sorting capabilities
   - Bulk actions
   - Status management

4. **UserTable**
   - User listing
   - Role management
   - Status controls
   - Action buttons
   - Filter options

5. **DashboardStats**
   - Key metrics display
   - Performance indicators
   - Trend visualization
   - Real-time updates

6. **BulkOperations**
   - Mass content updates
   - Batch processing
   - Status changes
   - Content organization

7. **SeriesManager**
   - Series organization
   - Episode management
   - Content scheduling
   - Metadata control

### Admin Security Features

1. **Access Control**
   - Role-based permissions
   - Action authorization
   - IP restrictions
   - Session management

2. **Audit Trail**
   - Action logging
   - User tracking
   - Change history
   - Security monitoring

3. **Data Protection**
   - Sensitive data handling
   - Encryption
   - Access logging
   - Backup systems

### Admin Workflow

1. **Content Management**
   - Content upload
   - Metadata editing
   - Quality control
   - Publishing workflow
   - Version management

2. **User Management**
   - Account creation
   - Role assignment
   - Permission setup
   - Support handling
   - Account maintenance

3. **Analytics Processing**
   - Data collection
   - Report generation
   - Trend analysis
   - Performance monitoring
   - Decision support 
