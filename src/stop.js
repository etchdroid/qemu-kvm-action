import * as core from '@actions/core'
import { getRunId, sleep } from './utils.js'
import * as fs from 'fs'
import * as process from 'node:process'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  let runId = core.getInput('run-id')
  if (!runId) runId = getRunId()

  const workDir = `/tmp/qemu-action-${runId}`

  const processKillOrder = ['qemu', 'ffmpeg', 'i3', 'xvfb']

  for (const p of processKillOrder) {
    if (!fs.existsSync(`${workDir}/${p}.pid`)) {
      console.log(`No PID file found for ${p}`)
      continue
    }

    const pid = fs.readFileSync(`${workDir}/${p}.pid`, 'utf8').trim()
    console.log(`Killing ${p} with PID ${pid}`)

    let killed = false
    for (let i = 0; i < 20; i++) {
      if (!fs.existsSync(`/proc/${pid}`)) {
        console.log(`${p} with PID ${pid} is already dead`)
        killed = true
        break
      }

      try {
        process.kill(parseInt(pid), 'SIGTERM')
        killed = true
        break
      } catch (error) {
        console.warn(`Failed to kill ${p} with PID ${pid}: ${error.message}`)
        await sleep(500)
      }
    }

    if (!killed) {
      console.log(`Failed to kill ${p} with PID ${pid}, sending SIGKILL`)
      try {
        p.kill(pid, 'SIGKILL')
      } catch (error) {
        console.error(`Failed to kill ${p} with PID ${pid}: ${error.message}`)
      }
    }

    fs.rmSync(`${workDir}/${p}.pid`)
  }
}

run().catch((error) => {
  core.setFailed(error.message)
  throw error
})
