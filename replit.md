# Overview

This project is a full-stack investment proposal management system for Opian Capital. It's a PDF form digitization tool that allows users to input investment proposal data through a web interface and generate professional PDF proposals. The application features real-time investment calculations, form validation, and PDF generation capabilities for investment proposals with detailed financial projections.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Modern React 18 application using functional components and hooks
- **Vite Build System**: Fast development server and optimized production builds
- **ShadcN UI Components**: Comprehensive UI component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **React Hook Form**: Form management with Zod schema validation
- **TanStack Query**: Server state management and data fetching
- **Wouter**: Lightweight client-side routing

## Backend Architecture
- **Express.js Server**: RESTful API with TypeScript support
- **In-Memory Storage**: Simple storage implementation using Maps for development
- **PDF Generation**: Server-side PDF creation using pdf-lib for investment proposals
- **Drizzle ORM**: Type-safe database toolkit ready for PostgreSQL integration
- **ESM Modules**: Modern ES module system throughout the codebase

## Data Layer
- **Drizzle Schema**: Well-defined database schemas for users and proposals
- **Zod Validation**: Runtime type checking and form validation
- **PostgreSQL Ready**: Database configuration prepared for production deployment
- **Type Safety**: End-to-end TypeScript types from database to frontend

## Key Features
- **Real-time Calculations**: Live investment projection calculations as users input data
- **Form Validation**: Comprehensive client and server-side validation
- **PDF Generation**: Professional proposal document generation with financial projections
- **Responsive Design**: Mobile-first design with proper breakpoints
- **Development Tools**: Hot reload, error overlays, and development banner integration

## Project Structure
- `client/`: React frontend application with components, pages, and utilities
- `server/`: Express backend with routes, storage, and PDF generation
- `shared/`: Common schemas and types shared between frontend and backend
- Component organization follows atomic design with reusable UI components

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL for production deployment
- **Drizzle Kit**: Database migration and schema management tools

## UI Framework
- **Radix UI**: Accessible component primitives for complex UI elements
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Styling framework with CSS variables for theming

## Development Tools
- **Replit Integration**: Development environment optimizations and error handling
- **TypeScript**: Static typing throughout the entire application
- **Vite Plugins**: Development experience enhancements and build optimizations

## PDF Generation
- **pdf-lib**: Client-side PDF document creation and manipulation
- **Standard Fonts**: Helvetica font family for professional document appearance

## Validation & Forms
- **Zod**: Schema validation for forms and API endpoints
- **React Hook Form**: Efficient form state management with validation integration
- **Date-fns**: Date manipulation and formatting utilities