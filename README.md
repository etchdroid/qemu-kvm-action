# QEMU/KVM Action for GitHub Actions

This action runs a QEMU/KVM virtual machine on GitHub Actions.

You can optionally record the screen of the virtual machine and upload it as an
artifact to debug your tests.

There are two ways to use this action:

- Use the main action to run a script while the virtual machine is running.
- Use the `setup`, `start`, and `stop` actions to control the virtual machine
  manually.

## Usage

### Main Action

```yaml
- name: Run QEMU
  id: run-qemu
  uses: etchdroid/qemu-kvm-action@v1
  with:
    video-record: true
    kernel: vmlinuz
    initrd: initrd
    append: 'console=ttyS0'
    flags: |
      -usb
      -device
      nec-usb-xhci,id=xhci
      -drive
      if=none,id=usbstick,file=usb-storage.img,format=raw
      -device
      usb-storage,id=usbdrive,bus=xhci.0,drive=usbstick
    run: |
      echo "Hello, world!"

- name: Upload video
  uses: actions/upload-artifact@v4
  with:
    name: recording
    path: ${{ steps.run-qemu.outputs.video-output }}
```

This will run the script `echo "Hello, world!"` while the virtual machine is
running (but not inside the virtual machine!)

### Manual Control

```yaml
- name: Setup QEMU
  uses: etchdroid/qemu-kvm-action/setup@v1
  with:
    video-record: true

- name: Start QEMU
  id: start-qemu
  uses: etchdroid/qemu-kvm-action/start@v1
  with:
    video-record: true
    kernel: vmlinuz
    initrd: initrd
    append: 'console=ttyS0'
    flags: |
      -usb
      -device
      nec-usb-xhci,id=xhci
      -drive
      if=none,id=usbstick,file=usb-storage.img,format=raw
      -device
      usb-storage,id=usbdrive,bus=xhci.0,drive=usbstick
    run: |
      echo "Hello, world!"

- name: Run Script
  run: |
    echo "Hello, world!"

# You only need to explicitly stop the VM if you want to stop it before the end of the job.
# Otherwise, it will be stopped automatically at the end of the job.
# For instance, if you want to upload the video recording as an artifact you need to stop the VM first.
- name: Stop QEMU
  uses: etchdroid/qemu-kvm-action/stop@v1
  with:
    run-id: ${{ steps.start-qemu.run-id }}

- name: Upload video
  uses: actions/upload-artifact@v4
  with:
    name: recording
    path: ${{ steps.start-qemu.outputs.video-output }}
```
