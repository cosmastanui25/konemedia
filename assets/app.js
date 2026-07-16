/* KONE-MEDIA — tiny progressive enhancement.
   Pages are fully static; this only improves forms and nav.
   If it fails to load, the site still works and forms still submit. */
(function(){
  // Highlight the current section in the nav
  try{
    var here = location.pathname.replace(/\/+$/,'') || '/';
    document.querySelectorAll('#nav-list a').forEach(function(a){
      var href = a.getAttribute('href').replace(/\/+$/,'') || '/';
      if(href === here) a.setAttribute('aria-current','page');
    });
  }catch(e){}

  function validEmail(s){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s||'').trim()); }

  // AJAX-submit Netlify forms so the reader stays on the page (nicer than a redirect).
  // Falls back to a normal submit if anything goes wrong.
  function enhance(form, noteId, validate, okMsg){
    if(!form) return;
    var note = document.getElementById(noteId);
    form.addEventListener('submit', function(e){
      var msg = validate(form);
      if(msg){ e.preventDefault(); if(note){ note.style.display='block'; note.textContent = msg; } return; }
      e.preventDefault();
      if(note){ note.style.display='block'; note.textContent = 'Sending…'; }
      var data = new URLSearchParams(new FormData(form)).toString();
      fetch('/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:data })
        .then(function(){ if(note) note.textContent = okMsg; form.reset(); })
        .catch(function(){ form.submit(); }); // fall back to native submit
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    var nl = document.querySelector('form[name="newsletter"]');
    enhance(nl, 'nl-note', function(f){
      return validEmail(f.email && f.email.value) ? '' : 'Please enter a valid email address.';
    }, 'Thanks — you’re on the list. We’ll be in touch.');

    var cf = document.querySelector('form[name="contact"]');
    enhance(cf, 'cf-note', function(f){
      if(!f.name.value.trim() || !validEmail(f.email.value) || !f.message.value.trim())
        return 'Please add your name, a valid email and a message.';
      return '';
    }, 'Thank you — your message has been sent. We will get back to you soon.');

    // Category "Read more": reveal the next batch (default 20) of hidden cards
    var moreBtn = document.getElementById('cat-more');
    if(moreBtn){
      var step = parseInt(moreBtn.getAttribute('data-step') || '20', 10);
      moreBtn.addEventListener('click', function(){
        var hidden = document.querySelectorAll('.cat-grid .cat-hidden');
        for(var i=0; i<hidden.length && i<step; i++){ hidden[i].classList.remove('cat-hidden'); }
        var left = document.querySelectorAll('.cat-grid .cat-hidden').length;
        var count = moreBtn.querySelector('.more-count');
        if(left>0){ if(count) count.textContent = left + ' more'; }
        else { moreBtn.style.display = 'none'; }
      });
    }
  });
})();
