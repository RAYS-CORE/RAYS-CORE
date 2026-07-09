import { useCallback, useEffect, useRef, useState } from 'react'

export interface MicRecording {
  audio: Blob
  durationMs: number
  heardSpeech: boolean
}

export function useMicRecorder() {
  const [level, setLevel] = useState(0)
  const [recording, setRecording] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const heardSpeechRef = useRef(false)
  const silenceTriggeredRef = useRef(false)
  const silenceStartedAtRef = useRef<number | null>(null)
  const stopResolverRef = useRef<((recording: MicRecording | null) => void) | null>(null)

  const cleanup = () => {
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    void audioContextRef.current?.close()
    audioContextRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setLevel(0)
    setRecording(false)
    silenceTriggeredRef.current = false
  }

  useEffect(() => () => cleanup(), [])

  const startMeter = (stream: MediaStream, options: any) => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return

    try {
      const audioContext = new AudioContextCtor()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      const data = new Uint8Array(analyser.fftSize)

      source.connect(analyser)
      audioContextRef.current = audioContext

      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const value of data) {
          const centered = value - 128
          sum += centered * centered
        }

        const rms = Math.sqrt(sum / data.length)
        const normalized = Math.min(1, rms / 42)
        const now = Date.now()

        setLevel(normalized)
        options.onLevel?.(normalized)

        const speechThreshold = options.silenceLevel ?? 0
        const silenceMs = options.silenceMs ?? 0
        const idleSilenceMs = options.idleSilenceMs ?? 0

        if (speechThreshold > 0 && options.onSilence && !silenceTriggeredRef.current) {
          if (normalized >= speechThreshold) {
            heardSpeechRef.current = true
            silenceStartedAtRef.current = null
          } else if (heardSpeechRef.current && silenceMs > 0) {
            silenceStartedAtRef.current ??= now

            if (now - silenceStartedAtRef.current >= silenceMs) {
              silenceTriggeredRef.current = true
              options.onSilence()
              return
            }
          } else if (!heardSpeechRef.current && idleSilenceMs > 0 && now - startedAtRef.current >= idleSilenceMs) {
            silenceTriggeredRef.current = true
            options.onSilence()
            return
          }
        }

        animationRef.current = window.requestAnimationFrame(tick)
      }

      tick()
    } catch {
      setLevel(0)
    }
  }

  const start = async (options: any = {}) => {
    if (recorderRef.current) return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Microphone unsupported')
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      })
    } catch (error) {
      throw new Error('Microphone access denied or failed')
    }

    const mimeType =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/wav'].find(
        type => MediaRecorder.isTypeSupported(type)
      ) ?? ''

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (error) {
      stream.getTracks().forEach(track => track.stop())
      throw error
    }

    chunksRef.current = []
    streamRef.current = stream
    recorderRef.current = recorder
    heardSpeechRef.current = false
    silenceTriggeredRef.current = false
    silenceStartedAtRef.current = null
    startedAtRef.current = Date.now()

    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      const chunks = chunksRef.current
      const recordingType = recorder.mimeType || mimeType || 'audio/webm'
      const durationMs = Date.now() - startedAtRef.current
      const heardSpeech = heardSpeechRef.current

      chunksRef.current = []
      cleanup()

      const resolver = stopResolverRef.current
      stopResolverRef.current = null

      if (!chunks.length) {
        resolver?.(null)
        return
      }

      resolver?.({
        audio: new Blob(chunks, { type: recordingType }),
        durationMs,
        heardSpeech
      })
    }

    recorder.onerror = event => {
      const resolver = stopResolverRef.current
      stopResolverRef.current = null
      cleanup()
      options.onError?.((event as any).error)
      resolver?.(null)
    }

    recorder.start()
    setRecording(true)
    startMeter(stream, options)
  }

  const stop = () =>
    new Promise<MicRecording | null>(resolve => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        cleanup()
        resolve(null)
        return
      }
      stopResolverRef.current = resolve
      recorder.stop()
    })

  const cancel = () => {
    const recorder = recorderRef.current
    const resolver = stopResolverRef.current
    stopResolverRef.current = null

    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onerror = null
      recorder.onstop = null
      recorder.stop()
    }
    cleanup()
    resolver?.(null)
  }

  return { handle: { start, stop, cancel }, level, recording }
}

export type ConversationStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'

interface VoiceConversationOptions {
  busy: boolean
  enabled: boolean
  onFatalError?: () => void
  onSubmit: (text: string) => Promise<void> | void
  onTranscribeAudio: (audio: Blob) => Promise<string>
  onSpeakText: (text: string) => Promise<Blob>
  pendingResponse: () => { id: string; pending: boolean; text: string } | null
  consumePendingResponse: () => void
}

export function useVoiceConversation({
  busy,
  enabled,
  onFatalError,
  onSubmit,
  onTranscribeAudio,
  onSpeakText,
  pendingResponse,
  consumePendingResponse
}: VoiceConversationOptions) {
  const { handle, level } = useMicRecorder()
  const [status, setStatus] = useState<ConversationStatus>('idle')
  const [muted, setMuted] = useState(false)
  const turnTimeoutRef = useRef<number | null>(null)
  const pendingStartRef = useRef(false)
  const turnClosingRef = useRef(false)
  const awaitingSpokenResponseRef = useRef(false)
  const responseIdRef = useRef<string | null>(null)
  const spokenSourceLengthRef = useRef(0)
  const speechBufferRef = useRef('')
  const enabledRef = useRef(enabled)
  const mutedRef = useRef(muted)
  const busyRef = useRef(busy)
  const statusRef = useRef<ConversationStatus>('idle')
  const wasEnabledRef = useRef(enabled)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => { busyRef.current = busy }, [busy])
  useEffect(() => { statusRef.current = status }, [status])

  const clearTurnTimeout = () => {
    if (turnTimeoutRef.current) {
      window.clearTimeout(turnTimeoutRef.current)
      turnTimeoutRef.current = null
    }
  }

  const resetSpeechBuffer = () => {
    responseIdRef.current = null
    spokenSourceLengthRef.current = 0
    speechBufferRef.current = ''
  }

  const appendSpeechText = (text: string) => {
    if (!text) return
    speechBufferRef.current = `${speechBufferRef.current}${text}`
  }

  const takeSpeechChunk = (force = false): string | null => {
    const buffer = speechBufferRef.current.replace(/\\s+/g, ' ').trim()
    if (!buffer) {
      speechBufferRef.current = ''
      return null
    }

    const sentence = buffer.match(/^(.+?[.!?。！？])(?:\\s+|$)/)
    if (sentence?.[1] && (sentence[1].length >= 8 || force)) {
      const chunk = sentence[1].trim()
      speechBufferRef.current = buffer.slice(sentence[1].length).trim()
      return chunk
    }

    if (!force && buffer.length > 220) {
      const softBoundary = Math.max(
        buffer.lastIndexOf(', ', 180),
        buffer.lastIndexOf('; ', 180),
        buffer.lastIndexOf(': ', 180)
      )
      if (softBoundary > 80) {
        const chunk = buffer.slice(0, softBoundary + 1).trim()
        speechBufferRef.current = buffer.slice(softBoundary + 1).trim()
        return chunk
      }
    }

    if (!force) return null

    speechBufferRef.current = ''
    return buffer
  }

  const handleTurn = useCallback(
    async (forceTranscribe = false) => {
      if (turnClosingRef.current) return

      turnClosingRef.current = true
      clearTurnTimeout()
      setStatus('transcribing')

      try {
        const result = await handle.stop()
        if (!result || (!result.heardSpeech && !forceTranscribe) || !onTranscribeAudio) {
          if (enabledRef.current && !mutedRef.current && !busyRef.current && statusRef.current !== 'speaking') {
            pendingStartRef.current = true
          }
          setStatus('idle')
          return
        }

        try {
          const transcript = (await onTranscribeAudio(result.audio)).trim()
          if (!transcript) {
            if (enabledRef.current) pendingStartRef.current = true
            setStatus('idle')
            return
          }

          awaitingSpokenResponseRef.current = true
          resetSpeechBuffer()
          await onSubmit(transcript)
          setStatus('thinking')
        } catch (error) {
          console.error('Transcription failed:', error)
          if (enabledRef.current && !mutedRef.current && !busyRef.current) {
            pendingStartRef.current = true
          }
          setStatus('idle')
        }
      } finally {
        turnClosingRef.current = false
      }
    },
    [handle, onSubmit, onTranscribeAudio]
  )

  const startListening = useCallback(async () => {
    pendingStartRef.current = false

    if (!enabledRef.current || mutedRef.current || busyRef.current) return
    if (statusRef.current !== 'idle') return

    try {
      await handle.start({
        silenceLevel: 0.075,
        silenceMs: 1250,
        idleSilenceMs: 12000,
        onError: (error: any) => {
          console.error('Microphone failed', error)
          pendingStartRef.current = false
          onFatalError?.()
        },
        onSilence: () => void handleTurn()
      })
      setStatus('listening')
      turnTimeoutRef.current = window.setTimeout(() => void handleTurn(), 60000)
    } catch (error) {
      console.error('Could not start session', error)
      pendingStartRef.current = false
      setStatus('idle')
      onFatalError?.()
    }
  }, [handle, handleTurn, onFatalError])

  const speak = useCallback(
    async (text: string) => {
      setStatus('speaking')

      try {
        const blob = await onSpeakText(text)
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioElementRef.current = audio
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve() }
          audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
          audio.play().catch(reject)
        })
      } catch (error) {
        console.error('Playback failed', error)
      } finally {
        audioElementRef.current = null
        if (enabledRef.current) {
          pendingStartRef.current = true
        }
        setStatus('idle')
      }
    },
    [onSpeakText]
  )

  const start = useCallback(async () => {
    if (!onTranscribeAudio) {
      console.warn('Speech to text unavailable')
      onFatalError?.()
      return
    }

    setMuted(false)
    awaitingSpokenResponseRef.current = false
    resetSpeechBuffer()
    consumePendingResponse()
    pendingStartRef.current = true
    await startListening()
  }, [consumePendingResponse, onFatalError, onTranscribeAudio, startListening])

  const end = useCallback(async () => {
    pendingStartRef.current = false
    clearTurnTimeout()
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }
    handle.cancel()
    turnClosingRef.current = false
    awaitingSpokenResponseRef.current = false
    resetSpeechBuffer()
    consumePendingResponse()
    setMuted(false)
    setStatus('idle')
  }, [consumePendingResponse, handle])

  const stopTurn = useCallback(() => {
    if (statusRef.current === 'listening') {
      void handleTurn(true)
    }
  }, [handleTurn])

  const toggleMute = useCallback(() => {
    setMuted(value => {
      const next = !value
      if (next) {
        clearTurnTimeout()
        handle.cancel()
        setStatus('idle')
      } else if (enabledRef.current && !busyRef.current && statusRef.current === 'idle') {
        pendingStartRef.current = true
      }
      return next
    })
  }, [handle])

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (statusRef.current !== 'listening') return

      event.preventDefault()
      stopTurn()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [enabled, stopTurn])

  useEffect(() => {
    if (!enabled || muted) return

    if (awaitingSpokenResponseRef.current && status !== 'speaking') {
      const response = pendingResponse()
      if (response) {
        if (response.id !== responseIdRef.current) {
          resetSpeechBuffer()
          responseIdRef.current = response.id
        }
        if (response.text.length > spokenSourceLengthRef.current) {
          appendSpeechText(response.text.slice(spokenSourceLengthRef.current))
          spokenSourceLengthRef.current = response.text.length
        }

        const chunk = takeSpeechChunk(!response.pending && !busy)
        if (chunk) {
          void speak(chunk)
          return
        }

        if (!response.pending && !busy) {
          awaitingSpokenResponseRef.current = false
          consumePendingResponse()
          resetSpeechBuffer()
          pendingStartRef.current = true
          setStatus('idle')
          return
        }
      }

      if (!busy && status === 'thinking') {
        awaitingSpokenResponseRef.current = false
        resetSpeechBuffer()
        pendingStartRef.current = true
        setStatus('idle')
        return
      }
    }

    if (busy || status !== 'idle') return

    if (pendingStartRef.current) {
      void startListening()
    }
  }, [busy, consumePendingResponse, enabled, muted, pendingResponse, speak, startListening, status])

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) void start()
    if (!enabled && wasEnabledRef.current) void end()
    wasEnabledRef.current = enabled
  }, [enabled, end, start])

  return { end, level, muted, start, status, stopTurn, toggleMute }
}
