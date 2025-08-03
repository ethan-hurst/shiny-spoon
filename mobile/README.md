# TruthSource Mobile App

A React Native mobile application for the TruthSource B2B e-commerce data accuracy platform.

## Features

- **Authentication**: Secure login and signup with token-based authentication
- **Dashboard**: Real-time overview of key metrics and recent activity
- **Inventory Management**: View and manage product inventory
- **Order Management**: Create and track customer orders
- **System Monitoring**: Monitor performance and security alerts
- **Profile Management**: User account settings and preferences
- **Offline Support**: Works offline with data synchronization
- **Dark/Light Theme**: Customizable theme support

## Tech Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **React Navigation** for navigation
- **AsyncStorage** for local data persistence
- **Expo Linear Gradient** for UI enhancements
- **Context API** for state management

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start the development server**:

   ```bash
   npm start
   ```

3. **Run on iOS**:

   ```bash
   npm run ios
   ```

4. **Run on Android**:

   ```bash
   npm run android
   ```

5. **Run on web** (for testing):
   ```bash
   npm run web
   ```

## Project Structure

```
mobile/
├── src/
│   ├── contexts/
│   │   ├── AuthContext.tsx      # Authentication state management
│   │   └── ThemeContext.tsx     # Theme state management
│   ├── screens/
│   │   ├── LoginScreen.tsx      # Authentication screen
│   │   ├── DashboardScreen.tsx  # Main dashboard
│   │   ├── InventoryScreen.tsx  # Inventory management
│   │   ├── OrdersScreen.tsx     # Order management
│   │   ├── MonitoringScreen.tsx # System monitoring
│   │   └── ProfileScreen.tsx    # User profile
│   ├── components/              # Reusable components
│   ├── services/               # API services
│   ├── utils/                  # Utility functions
│   └── types/                  # TypeScript type definitions
├── App.tsx                     # Main app component
├── app.json                    # Expo configuration
└── package.json               # Dependencies
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_API_URL=https://your-truthsource-api.com
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### API Integration

The app is configured to work with the TruthSource backend API. Update the API endpoints in:

- `src/contexts/AuthContext.tsx` - Authentication endpoints
- `src/screens/DashboardScreen.tsx` - Dashboard data endpoints
- `src/services/` - API service functions

## Development

### Code Style

- Use TypeScript for all new files
- Follow React Native best practices
- Use functional components with hooks
- Implement proper error handling
- Add loading states for async operations

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Building for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android

# Build for web
expo build:web
```

## Deployment

### Expo Application Services (EAS)

1. **Install EAS CLI**:

   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Login to Expo**:

   ```bash
   eas login
   ```

3. **Configure EAS**:

   ```bash
   eas build:configure
   ```

4. **Build for production**:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

### App Store Deployment

1. **Submit to App Store**:

   ```bash
   eas submit --platform ios
   ```

2. **Submit to Google Play**:
   ```bash
   eas submit --platform android
   ```

## Features Roadmap

### Phase 1 (Current)

- ✅ Basic authentication
- ✅ Dashboard with metrics
- ✅ Navigation structure
- ✅ Theme support

### Phase 2 (Next)

- 🔄 Real-time data synchronization
- 🔄 Push notifications
- 🔄 Offline data caching
- 🔄 Advanced inventory management

### Phase 3 (Future)

- 📋 Advanced analytics dashboard
- 📋 Barcode scanning
- 📋 Photo capture for products
- 📋 Voice commands
- 📋 AR product visualization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For support and questions:

- **Documentation**: [TruthSource Docs](https://docs.tuthsource.com)
- **Issues**: [GitHub Issues](https://github.com/truthsource/mobile/issues)
- **Discord**: [TruthSource Community](https://discord.gg/truthsource)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
