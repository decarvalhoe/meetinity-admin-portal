# Meetinity Admin Portal

This repository contains the administration portal for the Meetinity platform, providing comprehensive user management and analytics capabilities.

## Overview

The admin portal is built with **React 18**, **TypeScript**, and **Vite**. It offers a modern interface for platform administrators to manage users, view analytics, and perform administrative tasks.

## Features

- **User Management**: Complete CRUD operations for user accounts with advanced filtering and search capabilities
- **Data Visualization**: Interactive charts and statistics using Chart.js and React Chart.js 2
- **Bulk Operations**: Perform actions on multiple users simultaneously (activate, deactivate, delete)
- **Export Functionality**: Export user data to CSV format for external analysis
- **Pagination**: Efficient handling of large datasets with customizable page sizes
- **Real-time Filtering**: Debounced search and filtering by status, industry, and date ranges

## Tech Stack

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Static typing for improved code quality and developer experience
- **@tanstack/react-table**: Powerful table component with sorting, filtering, and selection
- **Chart.js & React-Chart.js-2**: Interactive data visualization
- **Date-fns**: Date manipulation and formatting utilities
- **Axios**: HTTP client for API communication
- **Vite**: Fast build tool and development server

## Project Status

- **Progress**: 60%
- **Completed Features**: User management interface, data tables, filtering, bulk operations, export functionality
- **Pending Features**: Event management, user analytics dashboard, role-based permissions

## Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

Set API base url via `.env`:

```
VITE_API_BASE_URL=http://localhost:5000
```

## API Integration

The portal communicates with the Meetinity backend services through the API Gateway. Ensure the following services are running:

- API Gateway (port 5000)
- User Service (port 5001)
