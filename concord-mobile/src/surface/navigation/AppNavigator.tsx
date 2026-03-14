// Concord Mobile — Root Navigation
// Bottom tab navigation with core screens

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatScreen } from '../screens/ChatScreen';
import { LensesScreen } from '../screens/LensesScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { MeshStatusScreen } from '../screens/MeshStatusScreen';
import { AtlasScreen } from '../screens/AtlasScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { BuyCoinsScreen } from '../screens/BuyCoinsScreen';

export type RootTabParamList = {
  Chat: undefined;
  Lenses: undefined;
  Marketplace: undefined;
  Wallet: undefined;
  Mesh: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  Atlas: undefined;
  Settings: undefined;
  BuyCoins: undefined;
  LensDetail: { lensId: string };
  DTUDetail: { dtuId: string };
  PeerDetail: { peerId: string };
  TransactionDetail: { txId: string };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopColor: '#1a1a2e',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen
        name="Lenses"
        component={LensesScreen}
        options={{ tabBarLabel: 'Lenses' }}
      />
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ tabBarLabel: 'Market' }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarLabel: 'Wallet' }}
      />
      <Tab.Screen
        name="Mesh"
        component={MeshStatusScreen}
        options={{ tabBarLabel: 'Mesh' }}
      />
    </Tab.Navigator>
  );
}

// Deep linking configuration for checkout return flow
const linking = {
  prefixes: ['concordapp://'],
  config: {
    screens: {
      Main: {
        screens: {
          Wallet: 'checkout-complete',
        },
      },
      BuyCoins: 'buy-coins',
    },
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0f' },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Atlas" component={AtlasScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="BuyCoins" component={BuyCoinsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
