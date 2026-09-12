/* ==========================================================================
   Story Time Admin — upload progress UI.
   A plain <form method="post"> can't report upload progress (the browser
   just navigates away and back). Submitting it via XMLHttpRequest instead
   lets us drive a real percentage bar off xhr.upload.onprogress, then hand
   off to a normal page load once the server responds (upload.php still does
   its usual validate/save/flash-message/redirect — we just get progress for
   free along the way).
   ========================================================================== */
(function () {
  'use strict';

  const form = document.getElementById('uploadStoryForm');
  if (!form) return;

  const submitBtn = document.getElementById('uploadStoryBtn');
  const progressWrap = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('uploadProgressFill');
  const progressPct = document.getElementById('uploadProgressPct');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';
    progressWrap.classList.remove('admin-hidden');
    progressFill.style.width = '0%';
    progressPct.textContent = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', form.action, true);

    xhr.upload.addEventListener('progress', (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      progressFill.style.width = pct + '%';
      progressPct.textContent = pct + '%';
    });

    xhr.addEventListener('load', () => {
      // upload.php redirects on success/failure either way (flash message
      // is already stored server-side in the session) — just follow it to
      // get the normal post-upload dashboard reload with that message.
      progressFill.style.width = '100%';
      progressPct.textContent = '100%';
      window.location.href = 'dashboard.php';
    });

    xhr.addEventListener('error', () => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload Story';
      progressWrap.classList.add('admin-hidden');
      alert('Upload failed — please check your connection and try again.');
    });

    xhr.send(formData);
  });
})();
