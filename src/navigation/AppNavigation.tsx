import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Home from '../screen/tabs/Home'; // Ensure this is the correct path for Home component


import LanguageSelection from '../screen/LanguageSelection';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// function TabBarIcon({focused, icon, size}: any) {
//   return (
//     <View
//       style={[
//         styles.tabIconContainer,
//         focused && styles.tabIconContainerFocused,
//       ]}>
//       <Image
//         source={icon}
//         style={[
//           styles.tabBarIconStyle,
//           {tintColor: focused ? 'white' : '#B0B0B0', width: size, height: size},
//         ]}
//       />
//     </View>
//   );
// }

// function HomeTabs() {
//   return (
//     <Tab.Navigator
//       screenOptions={({route}) => ({
//         tabBarActiveTintColor: '#000',
//         tabBarInactiveTintColor: '#000',
//         tabBarStyle: styles.tabBarStyle,
//         tabBarIcon: ({focused, color, size}) => {
//           let icon;

//           if (route.name === 'home') {
//             icon = home;
//           } else if (route.name === 'profile') {
//             icon = user;
//           }
//           return <TabBarIcon focused={focused} icon={icon} size={size} />;
//         },
//       })}>
//       <Tab.Screen name="home" component={Home} options={{headerShown: false}} />
//       <Tab.Screen
//         name="profile"
//         component={Profile}
//         options={{headerShown: false}}
//       />
//     </Tab.Navigator>
//   );
// }

export default function AppNavigation() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
    <Stack.Screen name="LanguageSelection" component={LanguageSelection} />
      <Stack.Screen name="Home" component={Home} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarStyle: {
    fontFamily: 'Poppins-Bold',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: 70,
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarIconStyle: {},
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 35, // Adjust as needed
    height: 35, // Adjust as needed
    borderRadius: 25, // Half of width and height for circle
    backgroundColor: 'transparent', // Initial background color
  },
  tabIconContainerFocused: {
    backgroundColor: 'black',
  },
});
