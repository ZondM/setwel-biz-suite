/* Shared site behaviour: scroll-reveal + subtle pointer-tilt depth cards.
   No WebGL here — this runs on every page, including the ones that
   deliberately have no heavy 3D scene, so it has to be cheap. */
(function(){
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var revs = document.querySelectorAll('.reveal.pre');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (e.isIntersecting && e.target.getBoundingClientRect().top > innerHeight * 0.5) e.target.classList.add('play');
        if (e.isIntersecting) io.unobserve(e.target);
      });
    }, {rootMargin:'0px 0px -8% 0px'});
    revs.forEach(function(el){ io.observe(el); });
  } else {
    revs.forEach(function(el){ el.classList.add('play'); });
  }

  if (!reduce && matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.tilt').forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(800px) rotateY(' + (x * 6) + 'deg) rotateX(' + (y * -6) + 'deg) translateY(-3px)';
      });
      card.addEventListener('mouseleave', function(){ card.style.transform = ''; });
    });
  }
})();
