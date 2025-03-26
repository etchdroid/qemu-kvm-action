import * as core from '@actions/core'
import hash from 'object-hash'

export function getConfig() {
  return {
    executable: core.getInput('qemu-executable'),
    cpu: core.getInput('cpu'),
    enableKvm: core.getInput('enable-kvm') === 'true',
    smp: parseInt(core.getInput('smp')),
    memory: parseInt(core.getInput('memory')),
    kernel: core.getInput('kernel'),
    initrd: core.getInput('initrd'),
    cmdline: core.getInput('cmdline'),
    flags: core.getInput('flags').split('\n').filter(Boolean),
    videoRecord: core.getInput('video-record') === 'true',
    videoOutput: core.getInput('video-output'),
    videoResolution: core.getInput('video-resolution'),
    xvfbScreen: core.getInput('xvfb-screen'),
    x11Display: core.getInput('x11-display')
  }
}

export function getRunId() {
  return hash(getConfig(), {
    unorderedArrays: true,
    unorderedSets: true,
    unorderedObjects: true
  })
}

/**
 * Wait for a subprocess to exit.
 *
 * @param {ChildProcess|ChildProcessWithoutNullStreams} subprocess
 * @returns {Promise<number>}
 */
export function waitForSubprocess(subprocess) {
  return new Promise((resolve, reject) => {
    let resolved = false
    subprocess.on('exit', (code) => {
      if (resolved) return
      if (code === 0) resolve(code)
      else reject(new Error(`Subprocess exited with code ${code}`))
    })
    subprocess.on('error', (error) => {
      if (resolved) return
      reject(error)
    })
  })
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
