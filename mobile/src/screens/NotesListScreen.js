import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { notesApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

const TAG_FILTERS = ['Arrays', 'DP', 'SQL']

export default function NotesListScreen({ navigation }) {
  const { user, logout } = useAuth()
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadNotes = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const data = await notesApi.list({ search, tag: activeTag })
      setNotes(data.notes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search, activeTag])

  useEffect(() => {
    const timeout = setTimeout(loadNotes, 250)
    return () => clearTimeout(timeout)
  }, [loadNotes])

  function toggleTag(tag) {
    setActiveTag((current) => (current === tag ? '' : tag))
  }

  function onRefresh() {
    setRefreshing(true)
    loadNotes({ silent: true })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={styles.headerTitle}>Your notes</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search notes…"
        placeholderTextColor="#8a93a6"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.tagRow}>
        {TAG_FILTERS.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[styles.tagChip, activeTag === tag && styles.tagChipActive]}
            onPress={() => toggleTag(tag)}
          >
            <Text style={[styles.tagChipText, activeTag === tag && styles.tagChipTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color="#d6b76a" style={styles.loader} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d6b76a" />}
          ListEmptyComponent={<Text style={styles.empty}>No notes match yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>{item.topic} · {item.note_type}</Text>
              {item.tags.length > 0 && (
                <View style={styles.cardTags}>
                  {item.tags.map((tag) => (
                    <Text key={tag} style={styles.cardTag}>{tag}</Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f17', paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { color: '#8a93a6', fontSize: 13 },
  headerTitle: { color: '#f4f7fc', fontSize: 24, fontWeight: '800' },
  logout: { color: '#8a93a6', fontSize: 13, marginTop: 6 },
  search: {
    backgroundColor: '#161c28',
    borderWidth: 1,
    borderColor: '#262f42',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f4f7fc',
    fontSize: 14,
    marginBottom: 12,
  },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tagChip: {
    borderWidth: 1,
    borderColor: '#262f42',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagChipActive: { backgroundColor: '#d6b76a', borderColor: '#d6b76a' },
  tagChipText: { color: '#8a93a6', fontSize: 13, fontWeight: '600' },
  tagChipTextActive: { color: '#0b0f17' },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },
  loader: { marginTop: 40 },
  list: { paddingBottom: 24 },
  empty: { color: '#8a93a6', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#161c28',
    borderWidth: 1,
    borderColor: '#262f42',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { color: '#f4f7fc', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardMeta: { color: '#8a93a6', fontSize: 12, marginBottom: 8 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardTag: {
    color: '#d6b76a',
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#3a3120',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
})
