import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardMetrics {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  syncAccuracy: number;
  activeAlerts: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Replace with actual API call
      const mockData: DashboardMetrics = {
        totalProducts: 1247,
        totalOrders: 89,
        totalCustomers: 156,
        syncAccuracy: 99.7,
        activeAlerts: 3,
        recentActivity: [
          {
            id: '1',
            type: 'order',
            description: 'New order #ORD-2024-001 created',
            timestamp: '2 minutes ago',
          },
          {
            id: '2',
            type: 'sync',
            description: 'Inventory sync completed with 99.9% accuracy',
            timestamp: '5 minutes ago',
          },
          {
            id: '3',
            type: 'alert',
            description: 'Price discrepancy detected for Product XYZ',
            timestamp: '10 minutes ago',
          },
        ],
      };
      setMetrics(mockData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return '📦';
      case 'sync':
        return '🔄';
      case 'alert':
        return '⚠️';
      default:
        return '📋';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.primary,
    },
    welcomeText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: 16,
      color: '#ffffff',
      opacity: 0.8,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    metricCard: {
      width: '48%',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: theme.spacing.xs,
    },
    metricLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    activityIcon: {
      fontSize: 20,
      marginRight: theme.spacing.md,
    },
    activityContent: {
      flex: 1,
    },
    activityDescription: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    activityTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: theme.spacing.lg,
    },
    actionButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
      flex: 1,
      marginHorizontal: theme.spacing.xs,
    },
    actionButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  if (!metrics) {
    return (
      <View style={styles.container}>
        <Text style={{ color: theme.colors.text, textAlign: 'center', marginTop: 50 }}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primary + '80']}
        style={styles.header}
      >
        <Text style={styles.welcomeText}>
          Welcome back, {user?.name || 'User'}!
        </Text>
        <Text style={styles.subtitle}>
          Here's what's happening with your data
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Inventory')}
          >
            <Text style={styles.actionButtonText}>View Inventory</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <Text style={styles.actionButtonText}>New Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Monitoring')}
          >
            <Text style={styles.actionButtonText}>Alerts</Text>
          </TouchableOpacity>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalProducts}</Text>
            <Text style={styles.metricLabel}>Total Products</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalOrders}</Text>
            <Text style={styles.metricLabel}>Orders Today</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalCustomers}</Text>
            <Text style={styles.metricLabel}>Active Customers</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.syncAccuracy}%</Text>
            <Text style={styles.metricLabel}>Sync Accuracy</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {metrics.recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <Text style={styles.activityIcon}>
                {getActivityIcon(activity.type)}
              </Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityDescription}>
                  {activity.description}
                </Text>
                <Text style={styles.activityTime}>{activity.timestamp}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Active Alerts */}
        {metrics.activeAlerts > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Alerts</Text>
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>⚠️</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityDescription}>
                  {metrics.activeAlerts} alerts require attention
                </Text>
                <Text style={styles.activityTime}>Tap to view details</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
} 