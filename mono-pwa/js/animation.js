/* ===== Cabinet Door Opening Animation ===== */

let animPlayed = false;

function playOpeningAnimation() {
  if (animPlayed) return;

  const overlay = document.getElementById('cabinet-anim-overlay');
  const doorLeft = overlay.querySelector('.cabinet-door-left');
  const doorRight = overlay.querySelector('.cabinet-door-right');

  // Small delay to let layout settle
  setTimeout(() => {
    doorLeft.classList.add('animate-open-left');
    doorRight.classList.add('animate-open-right');

    // After doors are open (700ms), fade out the overlay
    setTimeout(() => {
      overlay.classList.add('fade-out');

      // After fade (500ms), hide overlay and show app
      setTimeout(() => {
        overlay.classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        animPlayed = true;
        switchTab('home');
      }, 500);
    }, 750);
  }, 200);
}

// Check if this is a cold start (no session flag)
function isColdStart() {
  return !sessionStorage.getItem('mono_anim_played');
}

function markAnimationPlayed() {
  sessionStorage.setItem('mono_anim_played', '1');
}