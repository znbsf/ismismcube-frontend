<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { flushNotesBeforeLeave } from './utils/notesLeaveGuard'
import { notesUnsavedInMemory } from './utils/notesStore'
import { routeProgressHasPending } from './utils/routeProgress'

// Remains active after the notes editor is unmounted by navigation.
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  flushNotesBeforeLeave()
  if (!notesUnsavedInMemory.value && !routeProgressHasPending.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', handleBeforeUnload)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <router-view />
</template>
