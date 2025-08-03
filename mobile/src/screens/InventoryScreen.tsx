import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

export default function InventoryScreen() {
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
    },
  })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory Management</Text>
      <Text style={styles.subtitle}>
        View and manage your product inventory
      </Text>
    </View>
  )
}
