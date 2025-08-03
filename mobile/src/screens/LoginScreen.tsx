import React, { useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const { signIn, signUp, isLoading } = useAuth()
  const { theme } = useTheme()

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (isSignUp && !name) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    try {
      if (isSignUp) {
        await signUp(email, password, name)
      } else {
        await signIn(email, password)
      }
      // Navigation will be handled by the auth state change
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Authentication failed'
      )
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    gradient: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl * 2,
    },
    logo: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    form: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    toggleButton: {
      alignItems: 'center',
    },
    toggleText: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
  })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.background]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>TruthSource</Text>
            <Text style={styles.subtitle}>
              B2B E-commerce Data Accuracy Platform
            </Text>
          </View>

          <View style={styles.form}>
            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading && (
            <Text style={styles.loadingText}>Authenticating...</Text>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  )
}
