import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import LoginScreen from './src/screens/LoginScreen'
import NotesListScreen from './src/screens/NotesListScreen'
import NoteDetailScreen from './src/screens/NoteDetailScreen'

const Stack = createNativeStackNavigator()

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#0b0f17', card: '#0b0f17', border: '#262f42' },
}

function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0f17', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#d6b76a" />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0b0f17' }, headerTintColor: '#f4f7fc' }}>
      {user ? (
        <>
          <Stack.Screen name="NotesList" component={NotesListScreen} options={{ title: 'Notes', headerShown: false }} />
          <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ title: 'Note' }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={theme}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </AuthProvider>
  )
}
