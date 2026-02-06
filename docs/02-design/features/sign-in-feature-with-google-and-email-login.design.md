# Sign-in Feature with Google and Email Login Design Document

> Version: 1.0.0 | Created: 2026년 2월 2일 월요일 | Status: Draft

## 1. Overview
This document details the design for the "Sign-in Feature with Google and Email Login" as outlined in the plan document. It covers architectural considerations, data models, API specifications, and UI design aspects for integrating both Google OAuth and email/password authentication.

## 2. Architecture
### System Diagram
[A diagram illustrating the flow of authentication for both Google and email logins would be placed here. This would show the client-side interaction, backend API calls, interaction with Google's OAuth servers, and the application's database.]

### Components
- **Client-side UI Component (Frontend)**: Handles user interaction, displays login forms/buttons, and communicates with the backend API.
    - Google Sign-in Button
    - Email/Password Input Fields
    - Login Button
- **Authentication Service (Backend API)**: Manages authentication requests, verifies credentials, interacts with Google's OAuth service, and issues/validates authentication tokens.
    - `/api/auth/google` (for Google OAuth callback)
    - `/api/auth/login` (for email/password login)
- **User Service (Backend)**: Manages user data, including storing user profiles and hashed passwords (for email login).
- **Database**: Stores user information, roles, and potentially social login linkage.

## 3. Data Model
### Entities
```typescript
interface User {
  id: string;
  email: string;
  hashedPassword?: string; // For email login
  googleId?: string;      // For Google social login
  name: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Potentially a session or token entity if not using stateless JWTs
interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  // ... other session details
}
```

## 4. API Specification
### Endpoints
| Method | Path | Description | Request Body | Response Body |
|--------|------|-------------|--------------|---------------|
| `POST` | `/api/auth/login` | Authenticate user with email and password | `{ email: string, password: string }` | `{ token: string, user: User }` |
| `GET`  | `/api/auth/google` | Initiate Google OAuth flow (redirect) | None | Redirect to Google OAuth URL |
| `GET`  | `/api/auth/google/callback` | Google OAuth callback handler | (Query params from Google) | `{ token: string, user: User }` |
| `POST` | `/api/auth/logout` | Invalidate user session/token | None | `{ message: string }` |
| `GET`  | `/api/auth/me` | Get current authenticated user | None | `{ user: User }` |

## 5. UI Design
- **Location**: Upper right corner of the application.
- **States**:
    - **Logged Out**: Displays a "Sign In" button or link. Clicking it opens a modal or navigates to a login page.
    - **Login Modal/Page**: Contains:
        - "Sign in with Google" button (styled according to Google's brand guidelines).
        - "Sign in with Email" form with email input, password input, and a "Login" button.
        - Error message display area.
    - **Logged In**: Displays the user's avatar/name and a "Logout" button.
- **Mockups**: [Reference to Figma/Sketch mockups or wireframes for detailed UI designs.]

## 6. Test Plan
| Test Case | Expected Result |
|-----------|-----------------|
| User logs in with valid Google account | Successful login, user redirected/modal closes, UI shows logged-in state. |
| User logs in with valid email/password | Successful login, user redirected/modal closes, UI shows logged-in state. |
| User tries to login with invalid email/password | Error message displayed, login fails. |
| User cancels Google login flow | User remains logged out, no error displayed. |
| "Sign In" button visible when logged out | Button is present and clickable in upper right. |
| User avatar/name and "Logout" button visible when logged in | Elements are present and correctly display user info. |
