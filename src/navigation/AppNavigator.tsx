import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { EnrollScreen } from '../screens/EnrollScreen';
import { AuthenticateScreen } from '../screens/AuthenticateScreen';
import { RecordsScreen } from '../screens/RecordsScreen';

export type RootStackParamList = {
  Home: undefined;
  Enroll: undefined;
  Authenticate: undefined;
  Records: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#0F0F1A' },
          headerTintColor: '#00FF88',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0F0F1A' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Enroll" component={EnrollScreen} options={{ title: 'Enroll User' }} />
        <Stack.Screen name="Authenticate" component={AuthenticateScreen} options={{ title: 'Authenticate' }} />
        <Stack.Screen name="Records" component={RecordsScreen} options={{ title: 'Records' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
