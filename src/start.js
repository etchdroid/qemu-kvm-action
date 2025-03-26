import * as core from '@actions/core'
import { getConfig, getRunId, sleep, waitForSubprocess } from './utils.js'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'

// The comment is required since i3 on Ubuntu attempts to auto-detect a v3
// config file and convert it to v4, which breaks the config.
const i3config = `# i3 config file (v4)
font pango:monospace 12
default_border pixel 0
`

const dependencyMap = {
  'qemu-system-x86_64': [
    'qemu-system-x86',
    'qemu-utils',
    'ovmf',
    'qemu-system-gui',
    'qemu-system-modules-opengl'
  ],
  xdpyinfo: ['x11-utils'],
  ffmpeg: ['ffmpeg'],
  i3: ['i3-wm']
}

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  const config = getConfig()
  const runId = getRunId()
  core.setOutput('run-id', runId)
  core.setOutput('video-output', config.videoOutput)

  const workDir = `/tmp/qemu-action-${runId}`

  fs.mkdirSync(workDir)

  let subprocessEnv = process.env

  // Install dependencies if missing
  const dependenciesToInstall = []
  for (const [dependency, packages] of Object.entries(dependencyMap)) {
    const which = spawn('which', [dependency], { stdio: 'ignore' })
    try {
      await waitForSubprocess(which)
    } catch (error) {
      dependenciesToInstall.push(...packages)
    }
  }

  if (dependenciesToInstall.length > 0) {
    console.log('::group::Install dependencies')
    await waitForSubprocess(
      spawn(
        'sudo',
        [
          'apt-get',
          'install',
          '-y',
          '--no-install-recommends',
          ...dependenciesToInstall
        ],
        { stdio: 'inherit' }
      )
    )
    console.log('::endgroup::')
  }

  // Fix /dev/kvm ownership
  const currentUid = os.userInfo().uid
  await waitForSubprocess(
    spawn('sudo', ['chown', `${currentUid}`, '/dev/kvm'], {
      stdio: 'inherit'
    })
  )

  if (config.videoRecord) {
    // Start Xvfb
    console.log('Starting Xvfb')
    const xvfb = spawn(
      'Xvfb',
      [
        config.x11Display,
        '-screen',
        config.xvfbScreen,
        `${config.videoResolution}x24`,
        '-ac',
        '-nolisten',
        'tcp'
      ],
      {
        detached: true,
        stdio: 'ignore'
      }
    )
    xvfb.unref()
    core.setOutput('xvfb-pid', xvfb.pid)
    fs.writeFileSync(`${workDir}/xvfb.pid`, xvfb.pid.toString())

    subprocessEnv = {
      ...subprocessEnv,
      DISPLAY: `${config.x11Display}`
    }

    console.log('::group::Waiting for Xvfb to be ready')
    // Wait for Xvfb to be ready
    let started = false
    for (let i = 0; i < 120; i++) {
      try {
        await waitForSubprocess(
          spawn('xdpyinfo', ['-display', config.x11Display], {
            stdio: 'ignore'
          })
        )
        started = true
      } catch (error) {
        await sleep(500)
      }
    }
    console.log('::endgroup::')
    if (!started) {
      throw new Error('Xvfb did not start in time')
    }

    // Start i3wm
    console.log('Starting i3wm')
    const configFile = '/tmp/i3config'
    fs.writeFileSync(configFile, i3config)
    const i3 = spawn('i3', ['-c', configFile], {
      detached: true,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: subprocessEnv
    })
    i3.unref()
    core.setOutput('i3-pid', i3.pid)
    fs.writeFileSync(`${workDir}/i3.pid`, i3.pid.toString())

    // Start ffmpeg
    const ffmpegArgs = [
      '-f',
      'x11grab',
      '-i',
      `${config.x11Display}.0`,
      '-framerate',
      '30',
      '-c:v',
      'libx264',
      config.videoOutput
    ]
    console.log('Starting ffmpeg with args:')
    console.log(ffmpegArgs)
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      detached: true,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: subprocessEnv
    })
    ffmpeg.unref()
    core.setOutput('ffmpeg-pid', ffmpeg.pid)
    fs.writeFileSync(`${workDir}/ffmpeg.pid`, ffmpeg.pid.toString())
  }

  const qemuArgs = ['-cpu', config.cpu, '-m', config.memory, '-smp', config.smp]

  if (config.enableKvm) qemuArgs.push('-enable-kvm')
  if (config.kernel) qemuArgs.push('-kernel', config.kernel)
  if (config.initrd) qemuArgs.push('-initrd', config.initrd)
  if (config.cmdline) qemuArgs.push('-append', config.cmdline)
  if (config.flags.length > 0) qemuArgs.push(...config.flags)

  console.log('Starting QEMU with args:')
  console.log(qemuArgs)
  const qemu = spawn(config.executable, qemuArgs, {
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: subprocessEnv
  })
  qemu.unref()
  core.setOutput('qemu-pid', qemu.pid)
  fs.writeFileSync(`${workDir}/qemu.pid`, qemu.pid.toString())
}

run().catch((error) => {
  core.setFailed(error.message)
  throw error
})
