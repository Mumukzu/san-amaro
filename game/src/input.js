// Keyboard + mouse input for the 3D game.
// keys: held-key map by event.code (player.js reads input.keys directly).
// takeOrbit(): accumulated mouse movement since the last call (pointer lock
// or left-button drag). takeAction(name): one-shot presses, consumed once.
// Pointer lock on canvas click; blur releases every key.
export function createInput(canvas) {
  const keys = {};
  const pressed = new Set();
  let orbitX = 0;
  let orbitY = 0;
  let locked = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      keys[event.code] = true;
      return;
    }
    keys[event.code] = true;
    if (event.code === 'KeyE') pressed.add('enter');
    else if (event.code === 'KeyT') pressed.add('time');
    else if (event.code === 'KeyM') pressed.add('mute');
    else if (event.code === 'KeyH') pressed.add('help');
    else if (event.code === 'KeyP' || event.code === 'Escape') pressed.add('pause');
    else if (event.code === 'Enter' || event.code === 'Space') pressed.add('confirm');
    if (event.code === 'Space') event.preventDefault(); // page must not scroll
  });
  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    dragging = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const k of Object.keys(keys)) keys[k] = false;
      dragging = false;
    }
  });

  canvas.addEventListener('click', () => {
    try {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    } catch {
      // Pointer lock is a nicety; drag-orbit still works without it.
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (locked) {
      orbitX += event.movementX;
      orbitY += event.movementY;
    } else if (dragging) {
      orbitX += event.clientX - lastX;
      orbitY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  return {
    keys,
    takeOrbit() {
      const o = { x: orbitX, y: orbitY };
      orbitX = 0;
      orbitY = 0;
      return o;
    },
    takeAction(name) {
      if (pressed.has(name)) {
        pressed.delete(name);
        return true;
      }
      return false;
    },
    hasAction(name) {
      return pressed.has(name);
    },
    clearActions() {
      pressed.clear();
    },
    isLocked() {
      return locked;
    },
  };
}
