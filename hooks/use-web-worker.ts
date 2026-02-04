"use client"

import { useEffect, useRef, useState } from "react"

type WorkerMessage<T> = {
  type: string
  data: T
}

type WorkerResponse<R> = {
  success: boolean
  result?: R
  error?: string
}

/**
 * Hook to use Web Workers for heavy computations
 * Offloads work from main thread to improve INP
 */
export function useWebWorker<T, R>(workerPath: string) {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return

    try {
      const worker = new Worker(workerPath)

      worker.onmessage = () => {
        setIsReady(true)
      }

      worker.onerror = (err) => {
        setError(err.message)
        console.error("Worker error:", err)
      }

      workerRef.current = worker

      // Cleanup on unmount
      return () => {
        worker.terminate()
        workerRef.current = null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create worker")
    }
  }, [workerPath])

  const execute = async (type: string, data: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("Worker not initialized"))
        return
      }

      const handleMessage = (event: MessageEvent<WorkerResponse<R>>) => {
        workerRef.current?.removeEventListener("message", handleMessage)

        if (event.data.success && event.data.result !== undefined) {
          resolve(event.data.result)
        } else {
          reject(new Error(event.data.error || "Worker execution failed"))
        }
      }

      workerRef.current.addEventListener("message", handleMessage)

      const message: WorkerMessage<T> = { type, data }
      workerRef.current.postMessage(message)
    })
  }

  return { execute, isReady, error }
}

/**
 * Hook specifically for data transformation worker
 */
export function useDataTransformWorker() {
  return useWebWorker("/workers/data-transform.worker.js")
}
