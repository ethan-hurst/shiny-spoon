import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const { theme } = useTheme()

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    userInfo: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.lg,
      width: '100%',
    },
    userText: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    signOutButton: {
      backgroundColor: theme.colors.error,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      width: '100%',
      alignItems: 'center',
    },
    signOutText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your account settings</Text>

      <View style={styles.userInfo}>
        <Text style={styles.userText}>Name: {user?.name || 'N/A'}</Text>
        <Text style={styles.userText}>Email: {user?.email || 'N/A'}</Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}
