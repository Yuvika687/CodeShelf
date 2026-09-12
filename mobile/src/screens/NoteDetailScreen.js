import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { aiApi, notesApi } from '../api/client'

export default function NoteDetailScreen({ route }) {
  const { noteId } = route.params
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await notesApi.get(noteId)
        setNote(data.note)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [noteId])

  async function handleSummarize() {
    if (!note) return
    setSummarizing(true)
    setSummaryError('')
    try {
      const data = await aiApi.summarizeNote({
        text: note.content,
        note_id: note.id,
        title: note.title,
        topic: note.topic,
      })
      setSummary(data.summary)
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setSummarizing(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#d6b76a" />
      </View>
    )
  }

  if (error || !note) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Note not found.'}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{note.title}</Text>
      <Text style={styles.meta}>{note.topic} · {note.note_type} · {note.difficulty}</Text>

      {note.tags.length > 0 && (
        <View style={styles.tagRow}>
          {note.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      )}

      <Text style={styles.body}>{note.content}</Text>

      {note.code_snippet ? <Text style={styles.code}>{note.code_snippet}</Text> : null}

      <TouchableOpacity
        style={[styles.summarizeButton, summarizing && styles.summarizeButtonDisabled]}
        onPress={handleSummarize}
        disabled={summarizing}
      >
        {summarizing ? (
          <ActivityIndicator color="#0b0f17" />
        ) : (
          <Text style={styles.summarizeButtonText}>Summarize</Text>
        )}
      </TouchableOpacity>

      {summaryError ? <Text style={styles.error}>{summaryError}</Text> : null}

      {summary ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Summary</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f17' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0b0f17', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#f4f7fc', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  meta: { color: '#8a93a6', fontSize: 13, marginBottom: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: {
    color: '#d6b76a',
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#3a3120',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  body: { color: '#d7dce6', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  code: {
    color: '#9fe6b4',
    fontFamily: 'Courier',
    fontSize: 13,
    backgroundColor: '#111722',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  summarizeButton: {
    backgroundColor: '#d6b76a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  summarizeButtonDisabled: { opacity: 0.6 },
  summarizeButtonText: { color: '#0b0f17', fontSize: 15, fontWeight: '700' },
  summaryBox: {
    backgroundColor: '#161c28',
    borderWidth: 1,
    borderColor: '#262f42',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  summaryLabel: { color: '#d6b76a', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  summaryText: { color: '#f4f7fc', fontSize: 14, lineHeight: 20 },
  error: { color: '#ff6b6b', fontSize: 14 },
})
