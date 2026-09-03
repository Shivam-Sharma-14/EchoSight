import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, {useEffect} from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import AppNavigation from './src/navigation/AppNavigation';
import {prepareTts} from './src/services/tts';

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    void prepareTts('en');
  }, []);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle="light-content" backgroundColor="#340092" />
        <NavigationContainer>
          <AppNavigation />
        </NavigationContainer>
      </QueryClientProvider>
    </>
  );
};

export default App;

const styles = StyleSheet.create({});
