import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// Components
import { AuthProvider } from './src/contexts/AuthContext'
import { ThemeProvider } from './src/contexts/ThemeContext'
import DashboardScreen from './src/screens/DashboardScreen'
import InventoryScreen from './src/screens/InventoryScreen'
// Screens
import LoginScreen from './src/screens/LoginScreen'
import MonitoringScreen from './src/screens/MonitoringScreen'
import OrdersScreen from './src/screens/OrdersScreen'
import ProfileScreen from './src/screens/ProfileScreen'

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="package" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="shopping-cart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Monitoring"
        component={MonitoringScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="activity" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="user" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

function TabBarIcon({
  name,
  color,
  size,
}: {
  name: string
  color: string
  size: number
}) {
  return null // We'll implement this with react-native-vector-icons
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Main" component={TabNavigator} />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
